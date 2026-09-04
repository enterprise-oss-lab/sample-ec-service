# Inventory Service

在庫管理サービス。HTTP API と Kafka consumer による非同期在庫引き当ての両方をサポートする。

## 起動方法

### 1. インフラを起動

```bash
# リポジトリルートで実行
docker compose up -d
```

Inventory Service と PostgreSQL 、 Kafka (KRaft) が起動する。Kafka の起動完了は以下で確認できる。

```bash
docker compose ps
# kafka の Status が healthy になるまで待つ
```

### 2. DB の中身を確認

```bash
docker compose exec inventory-postgres \
  psql -U inventory -d inventory -c "SELECT * FROM inventories;"
```

```
 id | count
----+-------
  1 |   100
  2 |    80
  3 |    50
  4 |    30
  5 |   200
(5 rows)
```

---

## HTTP API

### 在庫確認

```bash
curl http://localhost:8080/inventories/1
```

```json
{"id":1,"count":100}
```

商品名などのカタログ属性は含まない (下の「カタログ参照」参照)。

### HTTP 経由で在庫引き当て

```bash
curl -X POST http://localhost:8080/inventories/1/reserve \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5}'
# → 204 No Content
```

### カタログ参照

商品のカタログ属性 (名前・説明・価格・画像) は在庫数と**更新頻度が違う**ため、`inventories` とは
別テーブル `products` に分けてある。在庫数は毎秒変わるがカタログは日〜月単位でしか変わらないので、
この境界がそのままキャッシュの境界になる。`inventories` は名前を持たない
(`id`/`count` のみ) ので、商品名が要る場合は `products` を参照すること。

```bash
curl http://localhost:8080/products/1
```

```json
{"id":1,"name":"Tシャツ（M）","description":"6.2oz ヘビーウェイト天竺。洗濯を繰り返しても首元が伸びにくい。","price":2980,"image_url":"https://placehold.co/400x300?text=T-Shirt+M"}
```

一覧は `GET /products`。エラー時のレスポンスは在庫 API と同じ形式。

```bash
curl http://localhost:8080/products/9999
# {"error":"product not found"}  → 404

curl http://localhost:8080/products/abc
# {"error":"invalid id"}         → 400
```

---

## Kafka による非同期在庫引き当て

### トピック構成

| トピック | 方向 | 説明 |
|---|---|---|
| `inventory.reservation.requests` | consume | 引き当てリクエストを受け取る |
| `inventory.reservation.results` | produce | 成否の結果を返す |

### メッセージスキーマ

**リクエスト**
```json
{
  "correlation_id": "ord-abc123",
  "inventory_id": 1,
  "quantity": 5
}
```

**レスポンス（成功）**
```json
{
  "correlation_id": "ord-abc123",
  "inventory_id": 1,
  "quantity": 5,
  "success": true,
  "error": ""
}
```

**レスポンス（失敗）**
```json
{
  "correlation_id": "ord-abc123",
  "inventory_id": 1,
  "quantity": 9999,
  "success": false,
  "error": "insufficient stock"
}
```

---

## 動作確認手順

以下の手順で「Kafka にメッセージを publish → 在庫が引かれる」ことを確認できる。

### ステップ 1: 現在の在庫を確認

```bash
curl http://localhost:8080/inventories/1
# {"id":1,"count":100}
```

### ステップ 2: result topic を購読（別ターミナルで実行）

```bash
docker compose exec kafka \
  /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic inventory.reservation.results \
  --from-beginning
```

このターミナルは開いたままにしておく。

### ステップ 3: リクエストを publish

```bash
echo '{"correlation_id":"ord-001","inventory_id":1,"quantity":5}' | \
  docker compose exec -T kafka \
  /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic inventory.reservation.requests
```

### ステップ 4: result topic に結果が届くことを確認

ステップ 2 のターミナルに以下が表示される。

```json
{"correlation_id":"ord-001","inventory_id":1,"quantity":5,"success":true,"error":""}
```

### ステップ 5: 在庫が減っていることを確認

```bash
curl http://localhost:8080/inventories/1
# {"id":1,"count":95}  ← 100 - 5 = 95
```

---

## 在庫不足のケースを確認

```bash
echo '{"correlation_id":"ord-002","inventory_id":1,"quantity":9999}' | \
  docker compose exec -T kafka \
  /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic inventory.reservation.requests
```

result topic に失敗メッセージが届き、在庫は変化しない。

```json
{"correlation_id":"ord-002","inventory_id":1,"quantity":9999,"success":false,"error":"insufficient stock"}
```

---

## 環境変数

| 変数 | デフォルト値 | 説明 |
|---|---|---|
| `DATABASE_URL` | `postgres://inventory:password@localhost:5432/inventory?sslmode=disable` | PostgreSQL 接続文字列 | <!-- pragma: allowlist secret -->
| `KAFKA_BROKERS` | `localhost:9092` | Kafka ブローカー（カンマ区切りで複数指定可） |
| `KAFKA_REQUEST_TOPIC` | `inventory.reservation.requests` | 引き当てリクエスト受信トピック |
| `KAFKA_RESULT_TOPIC` | `inventory.reservation.results` | 結果送信トピック |
| `KAFKA_CONSUMER_GROUP` | `inventory-service` | Consumer group ID |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (未設定) | OTLP エクスポート先 (例 `http://otel-lgtm:4317`)。未設定ならローカルの既定 `localhost:4317` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` | OTLP プロトコル |
| `OTEL_SERVICE_NAME` | (未設定) | トレース/メトリクス/ログの service.name (compose では `inventory`) |
| `OTEL_RESOURCE_ATTRIBUTES` | (未設定) | 追加リソース属性 (例 `service.namespace=sample-ec,deployment.environment=local`) |

OpenTelemetry の全体設計はリポジトリルートの [`docs/observability.md`](../../docs/observability.md) を参照。

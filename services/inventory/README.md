# Inventory Service

在庫管理サービス。HTTP API と Kafka consumer による非同期在庫引き当ての両方をサポートする。

## 起動方法

### 1. インフラを起動

```bash
# リポジトリルートで実行
docker compose up -d
```

PostgreSQL と Kafka (KRaft) が起動する。Kafka の起動完了は以下で確認できる。

```bash
docker compose ps
# kafka の Status が healthy になるまで待つ（~30秒）
```

### 2. DB を初期化

```bash
# テーブル作成
docker compose exec -T inventory-postgres \
  psql -U inventory -d inventory \
  -f - < services/inventory/db/migrations/001_create_inventories.sql

# 初期データ投入
docker compose exec -T inventory-postgres \
  psql -U inventory -d inventory \
  -f - < services/inventory/db/migrations/002_seed_inventories.sql
```

初期化済みか確認する場合:

```bash
docker compose exec inventory-postgres \
  psql -U inventory -d inventory -c "SELECT * FROM inventories;"
```

```
 id |      name        | count
----+------------------+-------
  1 | Tシャツ（M）     |   100
  2 | Tシャツ（L）     |    80
  3 | デニムパンツ     |    50
  4 | スニーカー（26cm）|    30
  5 | キャップ         |   200
```

### 3. サービスを起動



```bash
cd services/inventory
go run .
```

```
starting inventory service on :8080
```

---

## HTTP API

### 在庫確認

```bash
curl http://localhost:8080/inventories/1
```

```json
{"id":1,"name":"Tシャツ（M）","count":100}
```

### HTTP 経由で在庫引き当て

```bash
curl -X POST http://localhost:8080/inventories/1/reserve \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5}'
# → 204 No Content
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
# {"id":1,"name":"Tシャツ（M）","count":100}
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
# {"id":1,"name":"Tシャツ（M）","count":95}  ← 100 - 5 = 95
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

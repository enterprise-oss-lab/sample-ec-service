# Order Service

注文の作成・取得・キャンセルを行う。

## 技術スタック

- Python 3.12 (>= 3.10)
- FastAPI + Uvicorn
- PostgreSQL (asyncpg)
- Apache Kafka (confluent-kafka)

## アーキテクチャ

```
internal/
├── domain/          # エンティティ、ドメインルール
├── usecase/         # ビジネスロジック
├── adapter/
│   ├── http/        # FastAPI ルーター
│   └── kafka/       # Producer / Consumer
└── repository/
    └── postgres/    # DB 永続化
```

## API

| Method | Path | 説明 |
|--------|------|------|
| `POST` | `/orders` | 注文作成 (201) |
| `GET` | `/orders/{id}` | 注文取得 |
| `POST` | `/orders/{id}/cancel` | 注文キャンセル (204) |

## 注文ステータス

```
PENDING ─→ CONFIRMED   (在庫予約成功)
        ─→ FAILED      (在庫予約失敗)
        ─→ CANCELLED   (ユーザーキャンセル)
```

## Kafka 連携

| 方向 | トピック | 内容 |
|------|----------|------|
| Produce | `inventory.reservation.requests` | 在庫予約リクエスト |
| Consume | `inventory.reservation.results` | 在庫予約結果 |

注文作成時に予約リクエストを publish し、結果を非同期で consume して注文ステータスを更新する。

## 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `DATABASE_URL` | `postgresql://order:password@localhost:5432/order` | PostgreSQL 接続文字列 | # pragma: allowlist secret
| `KAFKA_BROKERS` | (必須) | Kafka ブローカーアドレス |
| `KAFKA_REQUEST_TOPIC` | `inventory.reservation.requests` | 予約リクエストトピック |
| `KAFKA_RESULT_TOPIC` | `inventory.reservation.results` | 予約結果トピック |
| `KAFKA_CONSUMER_GROUP` | `order-service` | コンシューマグループ ID |

## 起動方法

### Docker Compose (推奨)

リポジトリルートから:

```bash
docker compose up
```

Kafka、PostgreSQL、Order Service がすべて起動する。サービスは `http://localhost:8081` でアクセス可能。

### ローカル実行

```bash
cd services/order
pip install -e ".[dev]"
python main.py
```

サーバーは `http://localhost:8080` で起動する。
事前に PostgreSQL と Kafka が起動している必要がある。

## 動作確認

### 1. サービス起動

```bash
docker compose up
```

### 2. Kafka topic の確認

```bash
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
__consumer_offsets
inventory.reservation.requests
inventory.reservation.results
```

### 3. 注文を作成する

```bash
curl -s -X POST http://localhost:8081/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "user-123", "items": [{"inventory_id": 1, "quantity": 2}]}' | jq .
```

レスポンス:

```json
{
  "id": "a1b2c3d4-...",
  "customer_id": "user-123",
  "items": [{ "inventory_id": 1, "quantity": 2 }],
  "status": "pending",
  "correlation_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "created_at": "2025-05-01T12:00:00+00:00",
  "updated_at": "2025-05-01T12:00:00+00:00"
}
```

注文は `pending` 状態で作成され、Kafka に在庫予約リクエストが publish される。

### 4. Kafka メッセージを確認する

別ターミナルで `inventory.reservation.requests` トピックを consume して、publish されたメッセージを確認:

```bash
docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic inventory.reservation.requests \
  --from-beginning
```

出力例:

```json
{"correlation_id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","inventory_id":1,"quantity":2}
```

### 5. 在庫予約結果を手動で publish する (Inventory Service の代わり)

Inventory Service がまだ存在しない場合、手動で結果メッセージを publish して Saga の流れを確認できる:

`kafka-console-producer.sh` の対話入力はわかりづらいため、1 行 publish する形で送る。

```bash
echo '{"correlation_id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","inventory_id":1,"quantity":2,"success":true,"error":""}' \
  | docker exec -i kafka /opt/kafka/bin/kafka-console-producer.sh \
      --bootstrap-server localhost:9092 \
      --topic inventory.reservation.results
```

`correlation_id` は手順 3 のレスポンスの値に置き換える。

### 6. 注文ステータスの更新を確認する

```bash
curl -s http://localhost:8081/orders/<注文ID> | jq .status
```

出力:

```
"confirmed"
```

`"success": false` で publish した場合は `"failed"` になる。

### 全体の流れ

```
curl POST /orders
    │
    ▼
Order Service: 注文を PENDING で DB 保存
    │
    ▼
Kafka topic: inventory.reservation.requests
    │  {"correlation_id":"...","inventory_id":1,"quantity":2}
    ▼
(Inventory Service が処理)
    │
    ▼
Kafka topic: inventory.reservation.results
    │  {"correlation_id":"...","success":true,...}
    ▼
Order Service: Consumer が受信 → 注文を CONFIRMED に更新
```

## DB マイグレーション

`db/migrations/` 配下の SQL ファイルが Docker Compose 起動時に自動適用される。

- `001_create_orders.sql` -- テーブル作成
- `002_seed_orders.sql` -- 開発用シードデータ

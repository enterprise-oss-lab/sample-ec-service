# 注文確定イベントのCDC配信

Order Serviceは注文確定と同じDBトランザクションで `outbox_events` へINSERTする。
Debezium PostgreSQL Connectorがcommit済みのWALを読み、Outbox Event Routerで
`order.confirmed` topicへ配信する。注文確定イベントをアプリケーションから直接Kafkaへ送らない。
既存の在庫予約Sagaのtopicと送受信はそのまま利用する。

## 起動・再登録

通常は `.env` を用意して `docker compose up -d` で自動登録される。
`kafka-init` がイベントtopicとConnect内部topicを明示作成してからConnectを起動する。
brokerの自動topic作成とConnectのsource topic自動作成はいずれも無効。
内部topic (`connect.configs`, `connect.offsets`, `connect.status`) はcompact設定で永続化する。

```bash
# 設定変更時も同じPUTで登録・更新する。connectorを削除しない。
docker compose run --rm order-outbox-init
curl -fsS http://localhost:8083/connectors/order-outbox/status
```

登録成功とtaskのRUNNING状態は別なので、status内のconnectorとtasksの両方を確認する。
Connect REST APIはlocalhostの8083だけへ公開する。
接続情報はローカルデモ用で、管理する設定は
`infrastructure/debezium/order-outbox.json`。パスワードはConnectの環境変数
`ORDER_DB_PASSWORD`をEnvVarConfigProviderで解決する。本番の認証・権限設計は対象外。

既存DB volumeを利用する場合、SQL初期化は再実行されないため、#56のmigrationを
未適用なら先に適用する（volumeを削除する必要はない）。logical replication設定を
反映するにはOrder DBのコンテナ再作成が必要。

```bash
docker compose up -d order-db
docker compose exec -T order-db psql -U order -d order -v ON_ERROR_STOP=1 \
  < services/order/db/migrations/004_create_outbox_events.sql
docker compose up -d kafka-connect order-outbox-init
```

## Kafka契約

- topic: `order.confirmed`（1 partition、ローカル環境ではreplication factor 1）
- key: `event_id` のUUID文字列。値の `event_id` も保持する。
- value: 以下のJSONオブジェクト。JSON文字列の二重エンコードや、Connectの
  `schema` / `payload` envelope、DB接続情報、Debeziumの `before` / `after` / `source` は含めない。
- 業務上の発生日時はpayloadの `occurred_at`（UTC）を使う。Kafkaレコードのtimestampは
  Debeziumのデフォルトを使い、業務日時の集計には利用しない。金額は整数の日本円。

```json
{
  "event_id": "65a21aaa-59bc-45a1-83fd-6467c9a096f8",
  "event_type": "order_confirmed",
  "occurred_at": "2026-10-30T00:00:00Z",
  "order_id": "0cd9ef9c-2974-40c5-ad85-0161719f4519",
  "items": [
    {
      "order_item_id": 1,
      "inventory_id": 1,
      "quantity": 2,
      "unit_price_at_order": 1000,
      "net_amount": 2000
    }
  ]
}
```

配信保証は **at-least-once**。初期snapshotは既存Outbox行を読み、その後WALを追跡する。
障害復旧・offsetの巻き戻し等で同じイベントが再送され得るため、Flink側は
`event_id` で重複排除する（#59）。Outboxは追記専用とし、cleanupはこの変更の範囲外。
未commit行とrollback行は配信しない。

Connectの設定・offset・状態はKafka volumeに、replication slot `order_outbox` と
publication `order_outbox` はOrder DB volumeに保持する。通常の再起動ではこれらを
削除しない。connector停止中はslotがWALを保持するため、長期間停止する際はDB容量を確認する。
DBやKafkaのvolumeを片側だけ初期化した場合の整合性復旧は自動化していない。

## スモーク検証

```bash
python3 infrastructure/debezium/smoke.py
```

Docker Compose 2.24.4以上（`!override`対応）が必要。専用 `outbox-smoke` projectで
空のPostgreSQL/Kafkaから起動し、commit済みのJSON payload、rollback・未commit行の非配信、
Connect停止中のINSERTの再起動後配信、初期化の再実行を検証する。
専用volumeは前後に削除し、既存ECコンテナとvolumeは操作しない。

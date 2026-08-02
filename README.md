# Sample EC Service

## Observability (OpenTelemetry)

order / inventory 両サービスは OpenTelemetry で計装され、**トレース・メトリクス・ログ**の3シグナルを
OTLP gRPC で `grafana/otel-lgtm` コンテナ (OTel Collector + Tempo + Loki + Prometheus + Grafana) に送る。
設計の詳細は [`docs/observability.md`](docs/observability.md) を参照。

### 使い方

```bash
docker compose up --build -d
```

起動後、Grafana を開く: <http://localhost:3000> (匿名アクセス可)。

注文を1件作成してトラフィックを生成:

```bash
curl -s -X POST http://localhost:8081/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "user-123", "items": [{"inventory_id": 1, "quantity": 2}]}'
```

Grafana の Explore で確認できるもの:

- **Tempo (traces)**: `POST /orders` から Kafka を経由して inventory の DB 更新・結果処理まで、
  saga 全体が**1本のトレース**として繋がる (`order → Kafka → inventory → Kafka → order`)。
- **Prometheus (metrics)**: order の HTTP メトリクス、inventory の Go ランタイムメトリクス、
  カスタム指標 `inventory.reservations{result=...}` / `order.status.transitions{status=...}`。
- **Loki (logs)**: 両サービスのログに `trace_id` が付与され、トレースからログへ相互ジャンプできる。

> `grafana/otel-lgtm` はデモ用途のためデータは永続化されない (コンテナ再作成でリセット)。

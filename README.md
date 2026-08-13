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
**「EC Overview (sample-ec-service)」ダッシュボード**が自動投入されており、Dashboards から開ける
(`observability/grafana/` の JSON を provisioning でマウント)。

注文を1件作成してトラフィックを生成:

```bash
curl -s -X POST http://localhost:8081/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "user-123", "items": [{"inventory_id": 1, "quantity": 2}]}'
```

ダッシュボードの全パネルをリアルな値で動かすには、EC 的な負荷を継続生成する k6 スクリプトを使う
(閲覧多め・購入少なめ、意図的なエラー混入): `k6 run k6/ec-traffic.js` (詳細は [`k6/README.md`](k6/README.md))。

Grafana の Explore で確認できるもの:

- **Tempo (traces)**: `POST /orders` から Kafka を経由して inventory の DB 更新・結果処理まで、
  saga 全体が**1本のトレース**として繋がる (`order → Kafka → inventory → Kafka → order`)。
- **Prometheus (metrics)**: order の HTTP メトリクス、inventory の Go ランタイムメトリクス、
  カスタム指標 `inventory.reservations{result=...}` / `order.status.transitions{status=...}`。
- **Loki (logs)**: 両サービスのログに `trace_id` が付与され、トレースからログへ相互ジャンプできる。

> `grafana/otel-lgtm` はデモ用途のためデータは永続化されない (コンテナ再作成でリセット)。

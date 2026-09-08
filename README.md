# Sample EC Service

EC サイトを模したマイクロサービス構成のサンプルアプリケーション。注文・在庫の 2 サービスが Kafka 経由で連携し、Saga パターンで注文ステータスを更新する。

## 構成

| コンポーネント | パス | 技術スタック | 説明 |
|---|---|---|---|
| Storefront | [`frontends/storefront`](frontends/storefront) | React 19 + TypeScript + Vite + TailwindCSS v4 | 購入者向けフロントエンド |
| Admin | [`frontends/admin`](frontends/admin) | React 19 + TypeScript + Vite + TailwindCSS v4 | 管理者向け在庫管理フロントエンド（**ローカル専用、外部公開禁止**。詳細は[README](frontends/admin/README.md)） |
| Order Service | [`services/order`](services/order) | Python (FastAPI) + PostgreSQL + Kafka | 注文の作成・取得・キャンセル |
| Inventory Service | [`services/inventory`](services/inventory) | Go + PostgreSQL + Kafka | 在庫管理・非同期在庫引き当て・商品画像アップロード |
| RustFS | (compose のみ) | S3 互換オブジェクトストレージ | 商品画像の置き場。バケットは public read |

```
Storefront ──▶ Order Service ──▶ Kafka ──▶ Inventory Service
                    ▲                              │
                    └────────── Kafka（結果） ◀─────┘
```

Order Service が注文作成時に在庫予約リクエストを Kafka に publish し、Inventory Service が処理結果を Kafka 経由で返す。Order Service は結果を consume して注文ステータス（`PENDING` → `CONFIRMED` / `FAILED`）を更新する。

## クイックスタート

リポジトリルートで、Kafka・PostgreSQL・RustFS・各サービス・Storefront・Admin をまとめて起動する。

```bash
docker compose up -d
```

| サービス | URL |
|---|---|
| Grafana | http://localhost:3000 |
| Storefront | http://localhost:3001 |
| Admin | http://localhost:3002 |
| Order Service | http://localhost:8081 |
| Inventory Service | http://localhost:18081 |
| RustFS (S3 API / コンソール) | http://localhost:9000 / http://localhost:9001 |
| Kafka | localhost:19092 |

> **Postgres の migration は named volume が空のときしか実行されない。**
> `services/inventory/db/migrations/` を追加・変更した後、既存のボリュームには反映されないので
> `docker compose down -v` でボリュームを再作成してから `docker compose up -d` し直すこと。

Storefront・Admin はローカルで別途 HMR ありで起動することもできる
（[frontends/storefront/README.md](frontends/storefront/README.md) / [frontends/admin/README.md](frontends/admin/README.md) 参照）。

```bash
cd frontends/storefront   # or frontends/admin
pnpm install
pnpm dev
```

**Admin はローカル専用。外部に公開しないこと。** 認証・認可が入っておらず、画像アップロード API
（`POST /admin/images`）を認証なしで誰でも呼べるため、公開すると任意ファイルの公開ホスティング窓口になる。

## 各サービスの詳細

- [Order Service README](services/order/README.md) — API、Kafka 連携、動作確認手順
- [Inventory Service README](services/inventory/README.md) — HTTP API、Kafka トピック、動作確認手順
- [Storefront README](frontends/storefront/README.md) — 開発コマンド、アーキテクチャ概要
- [Admin README](frontends/admin/README.md) — 開発コマンド、アーキテクチャ概要、ローカル専用の注意

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

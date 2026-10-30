# Sample EC Service

## 品質チェック

リポジトリルートで、CIと同じチェックを実行できます。

```bash
make lint
make format-check
make format
```

`make lint-order`、`make format-check-admin` など、`Makefile` に記載された
コンポーネントごとのターゲットで個別に実行することもできます。Pythonの依存関係には
`services/order` の `dev` extra でRuffが含まれています。frontendの依存関係は
各アプリケーションの `pnpm-lock.yaml` で固定されています。

ローカルのblame出力で機械的なフォーマットコミットを隠すには、次を設定します。

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

### pre-commitのセットアップ

pre-commitはコミット前に、各コンポーネントでCIと同じLinter／Formatterを実行します。
ステージ済みのGo、Python、Admin、Storefrontのファイルは自動整形され、その後に該当する
Linterが実行されます。CIは最終的な品質ゲートとして維持されます。

最初に以下の前提ツールを用意してください。

- Gitと[pre-commit](https://pre-commit.com/)
- `services/inventory` 向けのGoと`golangci-lint`
- Python 3.10以上とOrder Serviceの開発用依存関係（Ruffを含む）
- Admin／Storefront向けのNode.jsとpnpm 10.32.1。frontendを変更してコミットする前に、
  各frontendで`pnpm install`を実行してください

pre-commitのコマンドラインツールを一度だけインストールします。`pipx`の利用を推奨します。

```bash
pipx install pre-commit
```

続いて、リポジトリをcloneした後に、このリポジトリ用のGit hookを別工程でインストールします。

```bash
pre-commit install
```

セットアップ後またはhook設定の更新後には、初回として全hookを実行してください。

```bash
pre-commit run --all-files
```

通常の`git commit`では、ステージ済みファイルだけにhookが実行されます。コンポーネントの
作業中や、該当する変更ファイル全体を対象に手動実行することもできます。

```bash
pre-commit run
pre-commit run ruff-format --files services/order/path/to_file.py
pre-commit run admin-eslint --files frontends/admin/src/path/to_file.tsx
```

Formatterがファイルを変更した場合は、変更内容を確認してステージし直してから再度コミット
してください。hookが報告したLinterエラーを修正し、該当コマンドを再実行するかコミットを
再試行してください。`git commit --no-verify`はローカルチェックを回避するため、常用せず、
例外的な場合にのみ使用してください。

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
初回は `.env.example` をコピーし、ローカル専用の認証情報を設定する。

```bash
cp .env.example .env
```

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
| ZITADEL | http://localhost:8080 |

### ローカル開発用ログインアカウント

下表は `.env.example` の初期値である。実際にログインする際は、Git 管理外の `.env` に設定した値を使用する。
自己登録は無効で、利用者はこの初期アカウントを使う。

| 用途 | ユーザー名 | パスワード |
|---|---|---|
| ZITADEL 運用管理 | `zitadel-admin@zitadel.localhost` | `ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD`（初期値: `ChangeMe1!`） |
| 購入者 1 | `ZITADEL_CUSTOMER_1_USERNAME`（初期値: `customer-one`） | `ZITADEL_CUSTOMER_1_PASSWORD`（初期値: `CustomerOne1!`） |
| 購入者 2 | `ZITADEL_CUSTOMER_2_USERNAME`（初期値: `customer-two`） | `ZITADEL_CUSTOMER_2_PASSWORD`（初期値: `CustomerTwo1!`） |
| EC 管理者 | `ZITADEL_ADMIN_USERNAME`（初期値: `ec-admin`） | `ZITADEL_ADMIN_PASSWORD`（初期値: `EcAdminOne1!`） |

ZITADEL 運用管理者は設定確認用であり、Storefront／Admin の動作確認には購入者または EC 管理者アカウントを使う。

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

**Admin はローカル専用。外部に公開しないこと。** ZITADEL の `admin` ロールを必須にしているが、開発用の管理画面としてのみ運用する。

## 認証・認可 E2E

実ZITADELのログイン画面を通る統合E2Eは、以下で実行する。Composeを起動・再ビルドし、購入者の注文と所有者制御、401/403、管理者の商品・在庫・画像APIを検証する。

```bash
make test-auth-e2e
```

テストデータと初期化済みローカル注文を破棄してやり直す場合は、先に `docker compose down -v` を実行してから `docker compose up -d` する。

## 各サービスの詳細

- [Order Service README](services/order/README.md) — API、Kafka 連携、動作確認手順
- [Inventory Service README](services/inventory/README.md) — HTTP API、Kafka トピック、動作確認手順
- [Storefront README](frontends/storefront/README.md) — 開発コマンド、アーキテクチャ概要
- [Admin README](frontends/admin/README.md) — 開発コマンド、アーキテクチャ概要、ローカル専用の注意

## 任意のローカル分析基盤

既存ECのRustFSを共有し、分析専用の`analytics` bucket、Iceberg REST catalog、Trinoを追加のCompose overlayとして起動できる。商品画像用の`products` bucketとは分離する。FlinkとCDCは後続Issueで追加する。

```bash
# 分析データだけを初期化し、bronze/gold作成、Icebergへの書き込み、Trinoで3行/合計60を検証
./scripts/analytics-smoke.sh clean
./scripts/analytics-smoke.sh all

# 共有RustFS・catalog・Trinoを再起動した後も同じ結果を読めることを検証
./scripts/analytics-smoke.sh restart-read

# データを保持して停止
./scripts/analytics-smoke.sh down
```

Trino UI は <http://localhost:28080>、共有RustFS consoleは <http://localhost:9001>。構成判断、固定バージョン、healthcheck、永続化と削除手順は [`docs/analytics-architecture.md`](docs/analytics-architecture.md) を参照する。既存ECだけを起動する従来の `docker compose up -d` には影響しない。Trinoのホスト側ポートは `ANALYTICS_TRINO_PORT` で変更できる。

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

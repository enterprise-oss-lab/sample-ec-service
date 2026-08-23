# Sample EC Service

EC サイトを模したマイクロサービス構成のサンプルアプリケーション。注文・在庫の 2 サービスが Kafka 経由で連携し、Saga パターンで注文ステータスを更新する。

## 構成

| コンポーネント | パス | 技術スタック | 説明 |
|---|---|---|---|
| Storefront | [`frontends/storefront`](frontends/storefront) | React 19 + TypeScript + Vite + TailwindCSS v4 | 購入者向けフロントエンド |
| Order Service | [`services/order`](services/order) | Python (FastAPI) + PostgreSQL + Kafka | 注文の作成・取得・キャンセル |
| Inventory Service | [`services/inventory`](services/inventory) | Go + PostgreSQL + Kafka | 在庫管理・非同期在庫引き当て |

```
Storefront ──▶ Order Service ──▶ Kafka ──▶ Inventory Service
                    ▲                              │
                    └────────── Kafka（結果） ◀─────┘
```

Order Service が注文作成時に在庫予約リクエストを Kafka に publish し、Inventory Service が処理結果を Kafka 経由で返す。Order Service は結果を consume して注文ステータス（`PENDING` → `CONFIRMED` / `FAILED`）を更新する。

## クイックスタート

リポジトリルートで、Kafka・PostgreSQL・各サービスをまとめて起動する。

```bash
docker compose up -d
```

- Order Service: http://localhost:8081
- Inventory Service: http://localhost:18080

Storefront はローカルで別途起動する（[frontends/storefront/README.md](frontends/storefront/README.md) 参照）。

```bash
cd frontends/storefront
pnpm install
pnpm dev
```

## 各サービスの詳細

- [Order Service README](services/order/README.md) — API、Kafka 連携、動作確認手順
- [Inventory Service README](services/inventory/README.md) — HTTP API、Kafka トピック、動作確認手順
- [Storefront README](frontends/storefront/README.md) — 開発コマンド、アーキテクチャ概要

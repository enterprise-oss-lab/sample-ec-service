# Admin (在庫管理)

在庫（= 商品）の CRUD と画像アップロードを行う管理者向けフロントエンド。詳細な設計は
[`docs/admin-inventory-management.md`](../../docs/admin-inventory-management.md) を参照。

> **ローカル専用。外部に公開しないこと。**
> 認証・認可は入っていない（後付け前提の構造だけ用意している）。`POST /admin/images` は
> 認証なしで誰でも呼べるため、公開すると任意ファイルの公開ホスティング窓口になってしまう。

## 前提

- リポジトリルートで `docker compose up -d` して inventory service（`http://localhost:18081`）と
  RustFS（`http://localhost:9000`）が起動していること
- migration 003（`price` / `description` / `image_key` などの追加カラム）は
  **既存の Postgres named volume には後から当たらない**。初回や DB スキーマを変更した後は
  `docker compose down -v` でボリュームを再作成してから `docker compose up -d` すること

## 開発コマンド

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # 型チェック + ビルド
pnpm lint
pnpm test:run     # vitest（api / hooks / components）
pnpm test:e2e     # Playwright（page.route でバックエンドをモック）
```

パッケージマネージャーは **pnpm** を使用する。

## 使い方

1. `/`（在庫一覧）で商品一覧と在庫数を確認。行内の − / ＋ でその場で在庫を増減できる
2. 「新規作成」で `/products/new` に遷移し、商品名・価格・説明・画像・初期在庫数を入力して保存
3. 一覧の「編集」で `/products/:id/edit` に遷移し、属性の変更・画像の差し替え・削除ができる
4. 画像は選択した時点で単独アップロードされ、`image_key` を保持した状態でフォームを保存する
   （保存前にキャンセルすると画像だけ孤児化するが、意図的に許容している設計）

## アーキテクチャ概要

**スタック**: React 19 + TypeScript + Vite + TailwindCSS v4 + React Router v7 + TanStack Query + msw + vitest + Playwright
（storefront と同スタック。ディレクトリ構成の方針も同じ: `pages/` = ルート単位、`features/<domain>/` = 機能ドメイン単位、`shared/` = 共通物）

### ルート

- `/` → `InventoryListPage`
- `/products/new` → `ProductNewPage`
- `/products/:id/edit` → `ProductEditPage`

在庫調整と削除は遷移を伴わず、一覧に留まったまま完結する。

### 環境変数

| 変数 | 説明 | ローカル既定値 |
|---|---|---|
| `VITE_INVENTORY_API_BASE_URL` | inventory service のベース URL | `http://localhost:18081` |
| `VITE_IMAGE_BASE_URL` | RustFS の画像バケットへのベース URL（ブラウザから直接参照するため `localhost` 側の URL） | `http://localhost:9000/products` |

### デザイン

storefront とは対照的に、業務ツールとしてライトテーマ・システムフォント・等幅数字・高密度テーブルを採用。
アクセント色に storefront の sage を借りる。

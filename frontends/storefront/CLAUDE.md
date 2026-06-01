# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コマンド

```bash
# 開発サーバー起動（HMR あり）
pnpm dev

# 型チェック + ビルド
pnpm build

# Lint
pnpm lint

# ビルド成果物のプレビュー
pnpm preview
```

パッケージマネージャーは **pnpm** を使用する。

## アーキテクチャ概要

**スタック**: React 19 + TypeScript 6 + Vite 8 + TailwindCSS v4 + React Router v7

### ディレクトリ構成の方針

```
src/
  pages/         # ルート単位のページコンポーネント（pages/<PageName>/index.tsx）
  features/      # 機能ドメイン単位のコンポーネント（features/<domain>/components/）
  shared/        # 複数ページで使われる共通コンポーネント（shared/<ComponentName>/index.tsx）
```

### ルーティング

`src/main.tsx` で `BrowserRouter` + `Routes` を宣言し、`Header` は全ルートに共通で配置される。

現在のルート:
- `/` → `HomePage`
- `/orders` → `OrderPage`

新規ページは `pages/` に追加し、`main.tsx` でルート登録する。

### スタイリング

TailwindCSS v4 を `@tailwindcss/vite` プラグイン経由で使用（`postcss.config` 不要）。

カスタムトークンは `src/index.css` の `@theme` ブロックで定義:
- **色**: `canvas`（背景）/ `panel` / `panel-hover` / `soft` / `dim` / `pale` / `gold`
- **フォント**: `font-display`（Cormorant Garamond）/ `font-mono`（JetBrains Mono）
- **アニメーション**: `animate-ticker` / `animate-pulse-dot` / `animate-fade-in-up`

動的に生成される値（グラデーション、インライン opacity 付きの hex カラーなど）は Tailwind クラスで表現できないため `style={}` で記述する。静的な値は Tailwind クラスを優先する。

### パスエイリアス

`vite.config.ts` で `@` → `./src` に解決される。

### フォント読み込み

Google Fonts は `useEffect` 内で動的に `<link>` タグを DOM に挿入する方式を採用している（`index.html` への静的追加ではない）。

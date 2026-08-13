# k6 負荷スクリプト — Grafana ダッシュボードをリアルに動かす

`ec-traffic.js` は order / inventory の HTTP API に **EC 的なミックス (閲覧多め・購入少なめ)** の
トラフィックを流し、Grafana ダッシュボード「EC Overview (sample-ec-service)」の全パネルを
自然な値で動かすための k6 スクリプトです。SLO・可用性・ビジネス成功率のパネルがリアルな
100% 未満の値になるよう、意図的にエラーを少量混ぜています。

## 前提

- スタックが起動済みであること:

  ```bash
  docker compose up --build -d
  ```

  全コンテナが healthy になってから流してください (order が Kafka consumer を起動し切る前だと
  saga が回らず confirmed/failed が出ません)。

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) がローカルにインストール済みであること
  (`brew install k6` など)。未インストールの場合は下の「Docker で実行」を参照。

既定の接続先はリポジトリの `compose.yaml` のホストポートに一致します:
`order = http://localhost:8081` / `inventory = http://localhost:18081`。

## 実行

リポジトリのルートから:

```bash
k6 run k6/ec-traffic.js
```

総尺は約 11 分 (ramp up → sustain → 緩やかなスパイク → ramp down)。途中で止めたいときは `Ctrl-C`。

### レートの調整

環境変数でピーク到着レート (req/s) を上書きできます:

```bash
k6 run -e BROWSE_RPS=20 -e PURCHASE_RPS=8 -e RESTOCK_RPS=3 k6/ec-traffic.js
```

| 変数 | 既定 | 意味 |
|---|---|---|
| `BROWSE_RPS` | `12` | 閲覧 (GET) のピーク到着レート |
| `PURCHASE_RPS` | `4` | 注文作成のピーク到着レート |
| `RESTOCK_RPS` | `2` | 在庫補充のレート (成功予約による在庫減少を補う) |
| `ORDER_URL` | `http://localhost:8081` | order サービスのベース URL |
| `INVENTORY_URL` | `http://localhost:18081` | inventory サービスのベース URL |

## 生成されるトラフィックと意図的エラー

3 つの k6 シナリオが同時に走ります:

- **browse** — 一覧 (`GET /inventories`) → 商品詳細 (`GET /inventories/{id}`) → 時々注文履歴
  (`GET /orders`)。約 5% で存在しない商品 ID を引いて **404** を出します。
- **purchase** — `POST /orders` を重み付きで発行:
  - ~80% 正常注文 (在庫内の数量) → `pending` → saga で `confirmed` + 在庫予約 success
  - ~12% **在庫超過**注文 (先頭 item の数量を巨大値に) → HTTP は 201 のまま、saga で
    `failed` + 在庫予約 **failure**
  - ~8% **不正 body** (空 items / 数量 0) → **422**
  - 作成後、時々注文詳細を閲覧、まれにキャンセル (pending なら `cancelled` 遷移)
- **restock** — `POST /inventories/{id}/restock` で在庫を継続補充。正常注文の成功予約で在庫が
  減り続けるため、これが無いと数分で在庫が枯渇し、以降すべて `failed` になってしまいます。
  意図的な在庫超過失敗 (12%) とは独立に、「適度なエラー率」を保つための仕組みです。

意図的な 4xx (404 / 422 / キャンセルの 422) は k6 の `http_req_failed` に計上されないよう
リクエスト個別に期待ステータスを設定しています。閾値は「意図しない 5xx / タイムアウト」だけを対象にしています。

## Grafana で確認

流している間に <http://localhost:3000> を開き、Dashboards →
**「EC Overview (sample-ec-service)」** を表示します (匿名アクセス可)。数十秒〜数分で:

- **SLI / SLO** — 閲覧可用性・p95、注文作成可用性、ビジネス成功率が値を表示 (エラー混入で 100% 未満)。
- **注文 & 在庫 saga** — `pending / confirmed / failed`、`success / failure` の系列が出る。
- **HTTP (order)** — ステータス別リクエストレート (201 / 422 など) と p50/p95/p99。
- **inventory ランタイム & DB** — Go goroutine / メモリ、pgx DB オペレーション p95。
- **ログ (Loki)** — order / inventory のログ (各行の trace_id からトレースへジャンプ可)。

Explore で直接メトリクスを見る場合の確認例:

```promql
sum by (status) (rate(order_status_transitions_total[1m]))
sum by (result) (rate(inventory_reservations_total[1m]))
```

## Docker で実行 (k6 未インストール時)

ルートから:

```bash
docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -v "$PWD/k6:/scripts" grafana/k6 run \
  -e ORDER_URL=http://host.docker.internal:8081 \
  -e INVENTORY_URL=http://host.docker.internal:18081 \
  /scripts/ec-traffic.js
```

`host.docker.internal` はコンテナからホストの公開ポートを指すためのものです (Linux では
`--add-host=host.docker.internal:host-gateway` が必要)。

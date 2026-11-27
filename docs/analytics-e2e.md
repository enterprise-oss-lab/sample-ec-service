# 確定売上 E2E

リポジトリルートから実行する。Docker Compose v2（`!reset` / `!override` 対応）と Python 3 が必要。
ホストへの Java / Go / Python パッケージのインストールや、`.env`・ZITADEL の準備は不要。

```sh
make test-analytics-e2e
```

専用の `analytics-e2e` Compose project と volume を作り、終了時に削除する。
通常環境のコンテナ・ポート・データは共有しない。同じテストの並列実行は不可。
初回はイメージ取得・ビルドに時間がかかる。Docker メモリの目安は 8 GiB。

1. 注文 HTTP API から複数明細の注文を作成し、実在庫予約を経て `confirmed` になることを確認する。
2. Trino に全明細が現れるまで待ち、明細 ID・商品 ID・数量・保存単価・金額・確定時刻を注文 DB と照合する。
3. サンプル SQL の日別・商品別の数量と確定売上額を確認する。
4. 同じ Outbox イベントを Kafka に再送する。後続注文が Trino まで届いた後で、元注文の行数と集計値が変わらないことを確認する。

認証は既存の認証 E2E に任せ、このテストだけ注文者を固定する。アプリケーションの認証設定は変更しない。
現行 Saga の在庫予約は先頭明細だけという制約があり、全明細の在庫予約を保証するテストではない。
変換・入力検証・重複排除などの詳細は既存単体テストで確認する。
個別 smoke は廃止し、停止中の追いつき・JobManager 再作成後の復旧・再起動後の永続性はこの E2E の対象外とする。

売上集計 SQL は [`analytics/trino/daily-confirmed-sales.sql`](../analytics/trino/daily-confirmed-sales.sql) にある。
日付は UTC、金額は整数円。通常環境での実行例:

```sh
docker exec -i sample-ec-service-analytics-trino-1 trino --file /dev/stdin \
  < analytics/trino/daily-confirmed-sales.sql
```

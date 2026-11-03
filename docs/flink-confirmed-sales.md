# Flink: 注文確定イベントから Bronze / Gold を生成

Issue #59。Java 17 / Flink 1.20.1 / Iceberg 1.8.1。
`order.confirmed` の値は Debezium Outbox Event Router が展開した JSON オブジェクト。
`event_id`, `event_type`, `occurred_at`, `order_id`, `items` を含む。
Kafka の key は event_id だが、検証と重複排除では payload の event_id を使う。

## 起動

リポジトリルートで実行する（通常の EC / CDC と同じ Compose project）。

```sh
docker compose -p sample-ec-service --env-file .env.example \
  -f compose.yaml -f compose.analytics.yaml -f compose.flink.yaml \
  up -d --build flink-jobmanager flink-taskmanager
```

CDC 自体の起動は [Outbox CDC](outbox-cdc.md) を参照。
Flink UI は http://localhost:28081 。Catalog、RustFS、Kafka は内部ネットワークを使う。
資格情報は既存ローカル PoC と同じ固定値。外部環境への展開を想定しない。

## データと整合性

- `bronze.order_confirmed_events`: 検証済みの元 JSON を payload に保持し、1イベント1行。
- `gold.fact_order_line`: 全明細を展開し、1イベントN行。論理キーは `(event_id, order_item_id)`。
- 日時は UTC に正規化した `timestamp(6)`。Trino の timestamp にタイムゾーンは付かない。
- 金額は整数円の BIGINT。quantity は正数、単価・金額は非負整数とし、乗算の overflow と payload 金額との不一致も拒否する。
- 同一イベント内の明細 ID 重複、必須項目欠損、型不正はイベント全体を拒否する。部分的に Gold に書かない。
- 異なる event_type は無視。無効イベントは `invalid_reason.<理由>.invalid_events` counter と WARN ログ、対象外は `ignored_events`、再送は `duplicate_events` で確認できる。Flink REST の vertex metrics API / UI を使用する。
- event_id の ValueState に TTL は設定しない。状態サイズはイベント数に比例する。恒久台帳や backfill は対象外。
- 10秒ごとの EXACTLY_ONCE checkpoint で Kafka offset・重複状態・Iceberg sink の未確定ファイルを保存する。Iceberg sink が checkpoint 完了通知後に snapshot を commit し、Trino は commit 済み snapshot だけを読む。
- Bronze と Gold の snapshot commit はテーブルごとであり、2テーブル横断の原子トランザクションではない。checkpoint 完了直後に見えるタイミングには差があり得る。
- 同じ状態・同じ operator UID から復旧することが必須。状態なしで earliest から起動すると既存テーブルへ二重書き込みになる。

## 再起動と復旧

TaskManager 障害は稼働中の JobManager が最新 checkpoint から自動再開する。
JobManager の再作成では、完了済み checkpoint の external_path を明示する。
UI または `GET /jobs/<job-id>/checkpoints` の `latest.completed.external_path` を記録する。
checkpoint は両サービスに共有する named volume に保持し、通常停止では削除しない。

```sh
# 上記と同じ -p / --env-file / -f を使用
export RESTORE_CHECKPOINT=file:///opt/flink/checkpoints/<job-id>/chk-<number>
docker compose -p sample-ec-service --env-file .env.example \
  -f compose.yaml -f compose.analytics.yaml -f compose.flink.yaml \
  up -d --force-recreate flink-jobmanager flink-taskmanager
```

起動後、復元済み checkpoint と RUNNING 状態、次の checkpoint 成功を確認する。
停止は同じ Compose 指定で `stop flink-jobmanager flink-taskmanager`。
復旧用 volume や Catalog / analytics bucket を片方だけ消してはいけない。
`analytics-smoke.sh clean` は実データの catalog / bucket も消すため、Flink 稼働中は実行しない。

## 検証

```sh
mvn -B -f analytics/flink/pom.xml verify
# Java 環境がない場合は Dockerfile のビルドでもテストする
docker build -t sample-ec-confirmed-sales:local analytics/flink
python3 analytics/flink/smoke.py
```

テストは複数明細・金額検証・不正値・event_id 再送・checkpoint snapshot/restore 後の重複排除を検証する。
smoke.py は専用 Compose project と専用 volume を作り、Kafka / Iceberg / Trino の実接続と
JobManager 再作成後の checkpoint 復元を検証する。終了時にその専用環境だけを削除する。
Trino からは `iceberg.bronze.order_confirmed_events` と `iceberg.gold.fact_order_line` を参照する。

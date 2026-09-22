# ローカル分析基盤 ADR

## 決定

分析基盤は `compose.analytics.yaml` に分離し、Spark 3.5.5 / Iceberg 1.8.1、Iceberg REST catalog 1.8.1、MinIO、Trino 483 を固定して使う。Spark と Trino は同じ REST catalog と `s3://warehouse/` を参照する。

HadoopCatalog は採用しない。Trino 483 の Iceberg connector が公式に列挙する catalog は Hive metastore、Glue、JDBC、REST、Nessie、Snowflake であり、HadoopCatalog は metadata catalog としてサポート対象に含まれない。両エンジンが公式に対応する REST catalog を共通境界とした。REST fixture の背後にある SQLite catalog と MinIO を named volume へ永続化するため、catalog のテーブルポインタと Iceberg metadata/data の両方が再起動後も残る。

これはローカル PoC 専用である。固定資格情報、認証なしのREST/Trino UI、単一ノードSQLite、`iceberg-rest-fixture` は本番用途ではない。ホストへの公開ポートは `18080` (Trino)、`18181` (catalog)、`19000/19001` (MinIO API/console)。外部公開しない。

## 運用特性

- 目安は Docker に 6 GiB 以上（Spark 2–3 GiB、Trino 1–2 GiB、残りをcatalog/MinIO）を割り当てる。
- 各常駐サービスに healthcheck があり、bucket 作成は冪等な one-shot service で行う。
- 通常停止は `./scripts/analytics-smoke.sh down`。named volume は残る。
- PoC データも削除する場合のみ `./scripts/analytics-smoke.sh clean` を使う。この操作は catalog と warehouse を復元不能に削除する。
- Spark と Trino のストレージ endpoint、region、path-style 設定および資格情報を一致させている。catalog DB と object storage の片方だけを削除・復元してはいけない。

## ライセンス

Apache Spark、Apache Iceberg、Trino は Apache License 2.0。MinIO server/client は AGPLv3。ここではローカル実行用コンテナを変更せず利用するが、配布・ネットワーク提供の条件は導入前に法務確認する。

## 参照仕様

- Trino 483 Iceberg connector: <https://trino.io/docs/483/connector/iceberg.html>
- Trino 483 Iceberg REST catalog: <https://trino.io/docs/483/object-storage/metastores.html#rest-catalog>
- Apache Iceberg REST catalog: <https://iceberg.apache.org/docs/1.8.1/rest-catalog-spec/>

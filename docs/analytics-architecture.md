# ローカル分析基盤 ADR

## 決定

分析基盤は `compose.analytics.yaml` overlayに分離し、既存EC ComposeのRustFS 1.0.0-rc.4を共有する。商品画像用`products`とは別に分析専用`analytics` bucketを作り、Iceberg REST catalog 1.8.1とTrino 483から使う。Trinoと後続Issue #59で追加するFlinkは、同じREST Catalog (`http://analytics-rest:8181`) とwarehouse (`s3://analytics/`) を参照する。Catalogがメタデータの正本であり、エンジン固有のcatalogは持たない。

HadoopCatalog は採用しない。Trino 483 の Iceberg connector が公式に列挙する catalog は Hive metastore、Glue、JDBC、REST、Nessie、Snowflake であり、HadoopCatalog は metadata catalog としてサポート対象に含まれない。両エンジンが公式に対応する REST catalog を共通境界とした。REST fixture の背後にある SQLite catalog と RustFS を named volume へ永続化するため、catalog のテーブルポインタと Iceberg metadata/data の両方が再起動後も残る。

これはローカル PoC 専用である。固定資格情報、認証なしのREST/Trino UI、単一ノードSQLite、`iceberg-rest-fixture` は本番用途ではない。分析側が追加するホスト公開ポートは `28080` (Trino)と`18181` (catalog)で、localhostだけに公開する。RustFSは既存ECの`9000/9001`を共有する。

## 運用特性

- 目安はDockerに3 GiB以上（Trino 1–2 GiB、残りをcatalogと共有RustFS）を割り当てる。
- 各常駐サービスにhealthcheckがあり、`analytics` bucket作成とcatalog volumeのUID 1000への権限設定は冪等なone-shot serviceで行う。
- 通常停止は`./scripts/analytics-smoke.sh down`。共有RustFSとnamed volumeは残る。
- `./scripts/analytics-smoke.sh clean`は`analytics` bucketとcatalog volumeだけを削除し、`products` bucketや業務DB volumeには触れない。
- Trinoと将来のFlinkで、REST Catalog URI、warehouse、ストレージendpoint、region、path-style設定および資格情報を一致させる。catalog DBとobject storageの片方だけを削除・復元してはいけない。

`bronze`と`gold` namespaceは `./scripts/analytics-smoke.sh all` が冪等に作成する。同じスクリプトは`bronze.catalog_smoke`へParquetデータを書き込み、Trinoから読めることを検証する。Trino catalogにはIceberg以外を定義せず、Order／Inventory PostgreSQLへは接続しない。

Flink側の接続値は次のとおり。Iceberg connectorとジョブ自体はIssue #59で追加する。

| 設定 | 値 |
|---|---|
| Catalog type | `rest` |
| REST URI | `http://analytics-rest:8181` |
| Warehouse | `s3://analytics/` |
| S3 endpoint | `http://rustfs:9000` |
| Region | `us-east-1` |
| Path-style access | `true` |

## ライセンス

Apache Iceberg、Trino は Apache License 2.0、RustFSはApache License 2.0。ここではローカル実行用コンテナを変更せず利用する。

## 参照仕様

- Trino 483 Iceberg connector: <https://trino.io/docs/483/connector/iceberg.html>
- Trino 483 Iceberg REST catalog: <https://trino.io/docs/483/object-storage/metastores.html#rest-catalog>
- Apache Iceberg REST catalog: <https://iceberg.apache.org/docs/1.8.1/rest-catalog-spec/>

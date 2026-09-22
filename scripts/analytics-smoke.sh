#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose -f compose.analytics.yaml)
spark_catalog=(
  --conf spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions
  --conf spark.sql.catalog.analytics=org.apache.iceberg.spark.SparkCatalog
  --conf spark.sql.catalog.analytics.type=rest
  --conf spark.sql.catalog.analytics.uri=http://analytics-rest:8181
  --conf spark.sql.catalog.analytics.warehouse=s3://warehouse/
  --conf spark.sql.catalog.analytics.io-impl=org.apache.iceberg.aws.s3.S3FileIO
  --conf spark.sql.catalog.analytics.s3.endpoint=http://analytics-minio:9000
  --conf spark.sql.catalog.analytics.s3.path-style-access=true
)

query_trino() {
  "${compose[@]}" exec -T analytics-trino trino --execute \
    "SELECT count(*) AS rows, sum(amount) AS amount FROM iceberg.smoke.orders"
}

case "${1:-all}" in
  all)
    "${compose[@]}" up -d --wait
    "${compose[@]}" exec -T analytics-spark spark-sql \
      "${spark_catalog[@]}" -f /opt/analytics/spark/bootstrap.sql
    result="$(query_trino)"
    printf '%s\n' "$result"
    grep -Eq '3[^0-9]+60' <<<"$result"
    ;;
  restart-read)
    "${compose[@]}" restart analytics-minio analytics-rest analytics-trino
    "${compose[@]}" up -d --wait
    result="$(query_trino)"
    printf '%s\n' "$result"
    grep -Eq '3[^0-9]+60' <<<"$result"
    ;;
  down)
    "${compose[@]}" down
    ;;
  clean)
    "${compose[@]}" down --volumes
    ;;
  *)
    echo "usage: $0 [all|restart-read|down|clean]" >&2
    exit 2
    ;;
esac

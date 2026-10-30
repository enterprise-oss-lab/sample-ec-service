#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose -p sample-ec-service --env-file .env.example -f compose.yaml -f compose.analytics.yaml)

run_aws() {
  "${compose[@]}" run --rm --no-deps --entrypoint aws analytics-object-storage-init \
    --endpoint-url http://rustfs:9000 "$@"
}

run_smoke_sql() {
  local output
  for _ in {1..30}; do
    if output="$("${compose[@]}" exec -T analytics-trino trino \
      --file /dev/stdin < analytics/tests/smoke.sql 2>&1)"; then
      return 0
    fi
    sleep 2
  done
  printf '%s\n' "$output" >&2
  return 1
}

query_trino() {
  local output
  for _ in {1..30}; do
    if output="$("${compose[@]}" exec -T analytics-trino trino --execute \
      "SELECT count(*) AS rows, sum(amount) AS amount FROM iceberg.bronze.catalog_smoke" 2>&1)"; then
      printf '%s\n' "$output"
      return 0
    fi
    sleep 2
  done
  printf '%s\n' "$output" >&2
  return 1
}

case "${1:-all}" in
  all)
    "${compose[@]}" up -d --wait analytics-rest analytics-trino
    "${compose[@]}" run --rm analytics-namespace-init
    run_smoke_sql
    schemas="$("${compose[@]}" exec -T analytics-trino trino --output-format TSV --execute \
      "SHOW SCHEMAS FROM iceberg")"
    grep -qx bronze <<<"$schemas"
    grep -qx gold <<<"$schemas"
    result="$(query_trino)"
    printf '%s\n' "$result"
    grep -Eq '3[^0-9]+60' <<<"$result"
    ;;
  restart-read)
    "${compose[@]}" restart rustfs analytics-rest analytics-trino
    "${compose[@]}" up -d --wait analytics-rest analytics-trino
    result="$(query_trino)"
    printf '%s\n' "$result"
    grep -Eq '3[^0-9]+60' <<<"$result"
    ;;
  down)
    "${compose[@]}" stop analytics-rest analytics-trino
    ;;
  clean)
    "${compose[@]}" rm -sf analytics-rest analytics-trino analytics-catalog-init analytics-namespace-init
    "${compose[@]}" up -d --wait rustfs
    if run_aws s3api head-bucket --bucket analytics 2>/dev/null; then
      run_aws s3 rm s3://analytics --recursive
      run_aws s3api delete-bucket --bucket analytics
    fi
    docker volume rm sample-ec-analytics-catalog-data 2>/dev/null || true
    ;;
  *)
    echo "usage: $0 [all|restart-read|down|clean]" >&2
    exit 2
    ;;
esac

#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose -f compose.analytics.yaml)

bootstrap_trino() {
  local output
  for _ in {1..30}; do
    if output="$("${compose[@]}" exec -T analytics-trino trino \
      --file /opt/analytics/bootstrap.sql 2>&1)"; then
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
    "${compose[@]}" up -d --wait
    bootstrap_trino
    schemas="$("${compose[@]}" exec -T analytics-trino trino --output-format TSV --execute \
      "SHOW SCHEMAS FROM iceberg")"
    grep -qx bronze <<<"$schemas"
    grep -qx gold <<<"$schemas"
    result="$(query_trino)"
    printf '%s\n' "$result"
    grep -Eq '3[^0-9]+60' <<<"$result"
    ;;
  restart-read)
    "${compose[@]}" restart analytics-object-storage analytics-rest analytics-trino
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

"""Order HTTP -> real reservation saga -> Outbox/CDC -> Flink -> Trino."""

import json
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = [
    "docker",
    "compose",
    "-p",
    "analytics-e2e",
    "--env-file",
    str(ROOT / ".env.example"),
    "-f",
    str(Path(__file__).with_name("compose.yaml")),
]


def compose(*args, check=True, input=None):
    result = subprocess.run(
        [*COMPOSE, *args],
        text=True,
        input=input,
        capture_output=True,
        timeout=300,
        check=False,
    )
    if check and result.returncode:
        raise RuntimeError(f"{args}: {result.stdout}\n{result.stderr}")
    return result


def wait_for(check, description, timeout=300):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        try:
            last = check()
            if last:
                return last
        except (RuntimeError, ValueError, KeyError) as error:
            last = str(error)
        time.sleep(2)
    raise AssertionError(f"Timeout: {description}; last result: {last}")


def http(service, port, path, data=None):
    args = ["curl", "-fsS", "--max-time", "10"]
    if data is not None:
        args += ["-H", "Content-Type: application/json", "--data", json.dumps(data)]
    return json.loads(
        compose("exec", "-T", service, *args, f"http://localhost:{port}/{path}").stdout
    )


def order_http(path, data=None, host="localhost:8080"):
    # Python is installed in the actual service image; curl is not.
    code = """
import json, sys, urllib.request
path, data, host = json.loads(sys.argv[1])
req = urllib.request.Request('http://' + host + '/' + path,
    data=None if data is None else json.dumps(data).encode(),
    headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=10) as response:
    print(response.read().decode())
"""
    return json.loads(
        compose(
            "exec",
            "-T",
            "order-service",
            "python",
            "-c",
            code,
            json.dumps([path, data, host]),
        ).stdout
    )


def query(statement):
    # Legacy Trino clients receive timestamps rounded to milliseconds.
    def request(*args):
        return json.loads(
            compose(
                "exec",
                "-T",
                "analytics-trino",
                "curl",
                "-fsS",
                "--max-time",
                "10",
                "-H",
                "X-Trino-User: analytics-e2e",
                "-H",
                "X-Trino-Client-Capabilities: PARAMETRIC_DATETIME",
                *args,
            ).stdout
        )

    result = request("--data", statement, "http://localhost:8080/v1/statement")
    rows = []
    deadline = time.monotonic() + 20
    while True:
        if "error" in result:
            raise RuntimeError(result["error"])
        rows.extend(result.get("data", []))
        if "nextUri" not in result:
            return rows
        if time.monotonic() >= deadline:
            request("-X", "DELETE", result["nextUri"])
            raise RuntimeError("Trino query timeout")
        result = request(result["nextUri"])


def db(statement):
    return json.loads(
        compose(
            "exec",
            "-T",
            "order-db",
            "psql",
            "-U",
            "order",
            "-Atc",
            statement,
        ).stdout
    )


def main():
    os.environ.pop("RESTORE_CHECKPOINT", None)
    try:
        compose("down", "-v", "--remove-orphans")
        subprocess.run(
            [
                *COMPOSE,
                "build",
                "inventory",
                "order-service",
                "flink-jobmanager",
                "analytics-rest",
            ],
            check=True,
            timeout=900,
        )
        compose(
            "up",
            "-d",
            "flink-jobmanager",
            "flink-taskmanager",
            "order-outbox-init",
            "inventory",
            "order-service",
        )
        job = wait_for(
            lambda: next(
                (
                    j["id"]
                    for j in http("flink-jobmanager", 8081, "jobs")["jobs"]
                    if j["status"] == "RUNNING"
                ),
                None,
            ),
            "Flink RUNNING",
        )
        wait_for(lambda: order_http("orders") == [], "Order HTTP ready")
        wait_for(
            lambda: order_http("products", host="inventory:8080"),
            "Inventory HTTP ready",
        )

        def connector_ready():
            status = http("kafka-connect", 8083, "connectors/order-outbox/status")
            return (
                status["connector"]["state"] == "RUNNING"
                and bool(status["tasks"])
                and all(t["state"] == "RUNNING" for t in status["tasks"])
            )

        wait_for(connector_ready, "Debezium connector/task RUNNING")
        # Both saga consumers use auto.offset.reset=latest. Wait for assignment
        # before publishing the first request, rather than sleeping a fixed time.
        for group in ("inventory-service", "order-service"):
            wait_for(
                lambda group=group: (
                    "STABLE"
                    in compose(
                        "exec",
                        "-T",
                        "kafka",
                        "/opt/kafka/bin/kafka-consumer-groups.sh",
                        "--bootstrap-server",
                        "kafka:9092",
                        "--describe",
                        "--group",
                        group,
                        "--state",
                    ).stdout.upper()
                ),
                f"{group} assigned",
            )
        orders = []
        # Repeated product across orders exercises SUM, two lines exercises expansion.
        for items in (
            [
                {"inventory_id": 1, "quantity": 2, "expected_unit_price": 2980},
                {"inventory_id": 3, "quantity": 3, "expected_unit_price": 8900},
            ],
            [{"inventory_id": 1, "quantity": 1, "expected_unit_price": 2980}],
        ):
            created = order_http("orders", {"items": items})
            order_id = created["id"]
            started = time.monotonic()  # Conservative: includes reservation latency.
            wait_for(
                lambda order_id=order_id: (
                    order_http(f"orders/{order_id}")["status"] == "confirmed"
                ),
                f"order {order_id} confirmed",
                timeout=60,
            )
            orders.append(order_id)
            print(f"Confirmed order_id={order_id}", flush=True)
            # Expected rows come independently from the authoritative order DB.
            expected = db(f"""SELECT json_agg(row_to_json(t) ORDER BY order_item_id)
                FROM (SELECT i.id AS order_item_id, i.inventory_id, i.quantity,
                    i.unit_price_at_order, i.quantity::bigint*i.unit_price_at_order AS net_amount,
                    to_char(o.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS confirmed_at
                    FROM orders o JOIN order_items i ON i.order_id=o.id
                    WHERE o.id='{order_id}') t""")
            expected_rows = [
                [
                    r[k]
                    for k in (
                        "order_item_id",
                        "inventory_id",
                        "quantity",
                        "unit_price_at_order",
                        "net_amount",
                        "confirmed_at",
                    )
                ]
                for r in expected
            ]

            def matches(order_id=order_id, expected_rows=expected_rows):
                rows = query(f"""SELECT order_item_id, inventory_id, quantity,
                    unit_price_at_order, net_amount, confirmed_at
                    FROM iceberg.gold.fact_order_line WHERE order_id='{order_id}'
                    ORDER BY order_item_id""")
                # Trino formats timestamps with microsecond precision.
                for row in rows:
                    row[-1] = datetime.fromisoformat(row[-1]).strftime(
                        "%Y-%m-%d %H:%M:%S.%f"
                    )
                return rows == expected_rows

            wait_for(
                matches,
                f"all lines for {order_id}",
                timeout=max(1, 300 - (time.monotonic() - started)),
            )
            elapsed = time.monotonic() - started
            print(f"Gold matched all lines in {elapsed:.1f}s: {order_id}", flush=True)
        stock = compose(
            "exec",
            "-T",
            "inventory-postgres",
            "psql",
            "-U",
            "inventory",
            "-Atc",
            "SELECT count FROM inventories WHERE id=1",
        ).stdout.strip()
        assert stock == "97", f"Real reservation did not reduce stock: {stock}"
        ids = ",".join(f"'{o}'" for o in orders)
        aggregate = f"""SELECT CAST(confirmed_at AS DATE), inventory_id, SUM(quantity), SUM(net_amount)
            FROM iceberg.gold.fact_order_line WHERE order_id IN ({ids}) GROUP BY 1,2 ORDER BY 1,2"""
        expected_aggregate = db(f"""SELECT json_agg(row_to_json(t)) FROM (
            SELECT (o.updated_at AT TIME ZONE 'UTC')::date::text AS day, i.inventory_id,
                SUM(i.quantity) AS quantity, SUM(i.quantity::bigint*i.unit_price_at_order) AS amount
            FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.id IN ({ids})
            GROUP BY 1,2 ORDER BY 1,2) t""")
        before = query(aggregate)
        sample = (
            Path(__file__).resolve().parents[1] / "trino" / "daily-confirmed-sales.sql"
        )
        assert query(sample.read_text().strip().rstrip(";")) == before
        assert before == [list(r.values()) for r in expected_aggregate], (
            before,
            expected_aggregate,
        )
        events = db(
            f"SELECT json_agg(payload) FROM outbox_events WHERE payload->>'order_id' IN ({ids})"
        )
        assert len(events) == len(orders)
        for event in events:
            event_id = event["event_id"]
            wait_for(
                lambda event_id=event_id: (
                    query(
                        f"SELECT count(*) FROM iceberg.bronze.order_confirmed_events WHERE event_id='{event_id}'"
                    )
                    == [[1]]
                ),
                "Bronze committed",
            )
        # A new event acts as a barrier: unchanged counts alone could pass before
        # the duplicate was consumed. The barrier must reach both Iceberg sinks.
        compose(
            "exec",
            "-T",
            "kafka",
            "/opt/kafka/bin/kafka-console-producer.sh",
            "--bootstrap-server",
            "kafka:9092",
            "--topic",
            "order.confirmed",
            input="\n".join(json.dumps(event) for event in events) + "\n",
        )
        barrier = order_http(
            "orders",
            {
                "items": [
                    {"inventory_id": 1, "quantity": 1, "expected_unit_price": 2980}
                ]
            },
        )["id"]
        wait_for(
            lambda: (
                query(
                    f"SELECT count(*) FROM iceberg.gold.fact_order_line WHERE order_id='{barrier}'"
                )
                == [[1]]
            ),
            "post-resend Gold barrier",
        )
        wait_for(
            lambda: (
                query(
                    f"SELECT count(*) FROM iceberg.bronze.order_confirmed_events WHERE order_id='{barrier}'"
                )
                == [[1]]
            ),
            "post-resend Bronze barrier",
        )
        assert query(aggregate) == before
        assert query(
            f"SELECT count(*) FROM iceberg.gold.fact_order_line WHERE order_id IN ({ids})"
        ) == [[3]]
        assert query(
            f"SELECT count(*) FROM iceberg.bronze.order_confirmed_events WHERE order_id IN ({ids})"
        ) == [[2]]
        assert http("flink-jobmanager", 8081, f"jobs/{job}")["state"] == "RUNNING"
        print(
            "PASS: order/reservation/CDC, all order lines, daily sales, resend dedup",
            flush=True,
        )
    except Exception:
        print(compose("ps", "-a", check=False).stdout)
        print(compose("logs", "--tail", "60", check=False).stdout)
        raise
    finally:
        compose("down", "-v", "--remove-orphans")


if __name__ == "__main__":
    main()

"""Run with python3 infrastructure/debezium/smoke.py (Docker Compose required)."""

import json
import subprocess
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = [
    "docker",
    "compose",
    "--project-name",
    "outbox-smoke",
    "--env-file",
    str(ROOT / ".env.example"),
    "-f",
    str(ROOT / "infrastructure/debezium/compose.smoke.yaml"),
]


def compose(*args, check=True):
    result = subprocess.run(
        [*COMPOSE, *args], text=True, capture_output=True, timeout=300
    )
    if check and result.returncode:
        raise RuntimeError(f"compose {args}: {result.stdout}\n{result.stderr}")
    return result


def sql(statement):
    return compose(
        "exec",
        "-T",
        "order-db",
        "psql",
        "-U",
        "order",
        "-d",
        "order",
        "-v",
        "ON_ERROR_STOP=1",
        "-Atc",
        statement,
    ).stdout


def ready():
    for _ in range(90):
        result = compose(
            "exec",
            "-T",
            "kafka-connect",
            "curl",
            "-fsS",
            "http://localhost:8083/connectors/order-outbox/status",
            check=False,
        )
        if result.returncode == 0:
            status = json.loads(result.stdout)
            tasks = status.get("tasks", [])
            if (
                tasks
                and status["connector"]["state"] == "RUNNING"
                and all(task["state"] == "RUNNING" for task in tasks)
            ):
                return
            if any(task["state"] == "FAILED" for task in tasks):
                raise AssertionError(status)
        time.sleep(2)
    raise AssertionError("connector did not become RUNNING")


def insert(event_id):
    payload = {
        "event_id": event_id,
        "event_type": "order_confirmed",
        "occurred_at": "2026-10-30T00:00:00Z",
        "order_id": str(uuid.uuid4()),
        "items": [
            {
                "order_item_id": 1,
                "inventory_id": 1,
                "quantity": 2,
                "unit_price_at_order": 1000,
                "net_amount": 2000,
            }
        ],
    }
    return (
        "INSERT INTO outbox_events(event_id,event_type,occurred_at,payload) VALUES "
        f"('{event_id}','order_confirmed','2026-10-30T00:00:00Z','{json.dumps(payload)}');"
    )


def events():
    result = compose(
        "exec",
        "-T",
        "kafka",
        "/opt/kafka/bin/kafka-console-consumer.sh",
        "--bootstrap-server",
        "kafka:9092",
        "--topic",
        "order.confirmed",
        "--from-beginning",
        "--timeout-ms",
        "10000",
        "--property",
        "print.key=true",
    )
    batch = []
    for line in result.stdout.splitlines():
        if line.strip():
            key, value = line.split("\t", 1)
            event = json.loads(value)
            assert key == event["event_id"], (key, event)
            batch.append(event)
    return batch


def main():
    try:
        # This project name and these volumes belong only to this smoke check.
        compose("down", "-v", "--remove-orphans")
        compose("up", "-d", "order-outbox-init")
        compose("wait", "order-outbox-init")
        ready()
        first, rolled_back, pending, resumed = [str(uuid.uuid4()) for _ in range(4)]
        sql(insert(first))
        sql("BEGIN;" + insert(rolled_back) + "ROLLBACK;")
        # Keep a real transaction open while Kafka is read. Exiting psql rolls it back.
        with subprocess.Popen(
            [
                *COMPOSE,
                "exec",
                "-T",
                "order-db",
                "psql",
                "-U",
                "order",
                "-d",
                "order",
                "-v",
                "ON_ERROR_STOP=1",
                "-At",
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as session:
            session.stdin.write("BEGIN;" + insert(pending) + "SELECT 'inserted';\n")
            session.stdin.flush()
            while session.stdout.readline().strip() != "inserted":
                if session.poll() is not None:
                    raise AssertionError("transaction session exited")
            batch = events()
            ids = {event["event_id"] for event in batch}
            assert first in ids, batch
            assert rolled_back not in ids and pending not in ids, batch
            session.stdin.write("ROLLBACK;\n\\q\n")
            session.stdin.flush()
            session.communicate(timeout=15)
        event = next(event for event in batch if event["event_id"] == first)
        assert set(event) == {
            "event_id",
            "event_type",
            "occurred_at",
            "order_id",
            "items",
        }, event
        assert event["items"][0]["net_amount"] == 2000, event
        compose("stop", "kafka-connect")
        sql(insert(resumed))
        compose("start", "kafka-connect")
        ready()
        batch = events()
        ids = {event["event_id"] for event in batch}
        assert {first, resumed} <= ids, batch
        assert not {rolled_back, pending} & ids, batch
        # PUT is safe to repeat without deleting the connector or its offsets.
        compose("run", "--rm", "--no-deps", "order-outbox-init")
        ready()
        print(
            "PASS: committed payload, rollback/uncommitted exclusion, restart recovery, repeatable init"
        )
    except Exception:
        print(compose("logs", "--tail", "60", check=False).stdout)
        raise
    finally:
        compose("down", "-v", "--remove-orphans")


if __name__ == "__main__":
    main()

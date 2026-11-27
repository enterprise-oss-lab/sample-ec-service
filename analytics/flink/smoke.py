"""Isolated Kafka -> Flink -> Iceberg -> Trino / checkpoint recovery check."""

import copy
import json
import os
import subprocess
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = [
    "docker",
    "compose",
    "-p",
    "flink-smoke",
    "--env-file",
    str(ROOT / ".env.example"),
    "-f",
    str(Path(__file__).with_name("compose.smoke.yaml")),
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


def api(path):
    return json.loads(
        compose(
            "exec",
            "-T",
            "flink-jobmanager",
            "curl",
            "-fsS",
            f"http://localhost:8081/{path}",
        ).stdout
    )


def wait_for(check, description):
    last = None
    for _ in range(120):
        try:
            result = check()
            if result:
                return result
        except (RuntimeError, KeyError, ValueError) as error:
            last = error
        time.sleep(2)
    raise AssertionError(f"Timeout: {description}; last error: {last}")


def publish(events):
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


def counts(expected):
    query = """
        SELECT (SELECT count(*) FROM iceberg.bronze.order_confirmed_events),
               count(*), coalesce(sum(net_amount), 0)
        FROM iceberg.gold.fact_order_line
    """

    # The CLI starts another JVM; use HTTP to keep the disposable stack small.
    def request(*args):
        return json.loads(
            compose(
                "exec",
                "-T",
                "analytics-trino",
                "curl",
                "-fsS",
                "--max-time",
                "20",
                "-H",
                "X-Trino-User: smoke",
                *args,
            ).stdout
        )

    result = request(
        "-X", "POST", "http://localhost:8080/v1/statement", "--data", query
    )
    rows = []
    while True:
        if "error" in result:
            return False
        rows.extend(result.get("data", []))
        if "nextUri" not in result:
            return rows == [list(map(int, expected.split("\t")))]
        result = request(result["nextUri"])


def main():
    os.environ.pop("RESTORE_CHECKPOINT", None)
    try:
        compose("down", "-v", "--remove-orphans")
        compose("up", "-d", "flink-jobmanager", "flink-taskmanager")
        job = wait_for(
            lambda: next(
                (
                    job["id"]
                    for job in api("jobs")["jobs"]
                    if job["status"] == "RUNNING"
                ),
                None,
            ),
            "running job",
        )
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "order_confirmed",
            "order_id": str(uuid.uuid4()),
            "occurred_at": "2026-10-31T00:00:00Z",
            "items": [
                {
                    "order_item_id": 1,
                    "inventory_id": 10,
                    "quantity": 2,
                    "unit_price_at_order": 100,
                    "net_amount": 200,
                },
                {
                    "order_item_id": 2,
                    "inventory_id": 11,
                    "quantity": 3,
                    "unit_price_at_order": 50,
                    "net_amount": 150,
                },
            ],
        }
        bad = copy.deepcopy(event)
        bad["event_id"] = str(uuid.uuid4())
        bad["items"][1]["net_amount"] = 151
        missing = copy.deepcopy(event)
        del missing["event_id"]
        publish([event, event, bad, missing, {"event_type": "other"}])
        wait_for(
            lambda: counts("1\t2\t350"),
            "one Bronze row / all Gold lines / duplicates excluded",
        )
        diagnostics = compose("logs", "flink-taskmanager").stdout
        assert "reason=net_amount_mismatch" in diagnostics, diagnostics
        assert "reason=event_id" in diagnostics, diagnostics
        print(
            "PASS: Bronze 1 / Gold 2 / amount 350, invalid and duplicate exclusion",
            flush=True,
        )
        # Ensure every input (including invalids) is covered by the restored offset.
        previous = api(f"jobs/{job}/checkpoints")["latest"]["completed"]["id"]
        checkpoint = wait_for(
            lambda: (
                completed
                if (
                    completed := api(f"jobs/{job}/checkpoints")["latest"].get(
                        "completed"
                    )
                )
                and completed["id"] > previous
                else None
            ),
            "next completed checkpoint",
        )
        compose("stop", "flink-taskmanager", "flink-jobmanager")
        os.environ["RESTORE_CHECKPOINT"] = checkpoint["external_path"]
        compose("up", "-d", "--force-recreate", "flink-jobmanager", "flink-taskmanager")
        restored_job = wait_for(
            lambda: next(
                (
                    job["id"]
                    for job in api("jobs")["jobs"]
                    if job["status"] == "RUNNING"
                ),
                None,
            ),
            "restored job",
        )
        restored = api(f"jobs/{restored_job}/checkpoints")["latest"]["restored"]
        assert restored["external_path"] == checkpoint["external_path"], restored
        print("PASS: JobManager restored the completed checkpoint", flush=True)
        next_event = copy.deepcopy(event)
        next_event["event_id"] = str(uuid.uuid4())
        publish([event, next_event])
        wait_for(lambda: counts("2\t4\t700"), "restored deduplication and new event")
        assert api(f"jobs/{restored_job}")["state"] == "RUNNING"
        print(
            "PASS: Bronze 1 / Gold N, validation, resend dedup, committed snapshots, checkpoint restart"
        )
    except Exception:
        print(compose("logs", "--tail", "60", check=False).stdout)
        raise
    finally:
        compose("down", "-v", "--remove-orphans")


if __name__ == "__main__":
    main()

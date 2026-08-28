import asyncio
import logging

from confluent_kafka import Producer
from opentelemetry import propagate, trace

from internal.adapter.kafka.message import ReservationRequest
from internal.usecase.order import KafkaProducerPort

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


class KafkaReservationProducer(KafkaProducerPort):
    def __init__(self, brokers: str, topic: str) -> None:
        self._producer = Producer({"bootstrap.servers": brokers, "acks": "1"})
        self._topic = topic

    async def publish_reservation_request(
        self,
        correlation_id: str,
        inventory_id: int,
        quantity: int,
    ) -> None:
        msg = ReservationRequest(
            correlation_id=correlation_id,
            inventory_id=inventory_id,
            quantity=quantity,
        )
        payload = msg.model_dump_json().encode()

        def delivery_report(err, _msg):
            if err:
                logger.error("kafka delivery failed: %s", err)

        with tracer.start_as_current_span(
            f"{self._topic} publish",
            kind=trace.SpanKind.PRODUCER,
            attributes={
                "messaging.system": "kafka",
                "messaging.destination.name": self._topic,
                "messaging.operation": "publish",
            },
        ):
            # trace context を W3C traceparent として Kafka ヘッダに注入 (手動伝播)
            carrier: dict[str, str] = {}
            propagate.inject(carrier)
            headers = [(k, v.encode()) for k, v in carrier.items()]

            # produce() はローカルキューに積むだけの非ブロッキング呼び出し。
            # rdkafka のバックグラウンドスレッドが実際の送信を行う。
            self._producer.produce(
                self._topic,
                key=correlation_id.encode(),
                value=payload,
                headers=headers,
                callback=delivery_report,
            )

        # 配信レポートのコールバックを捌く。timeout=0 なので非ブロッキングで、
        # イベントループを止めない (以前の flush(timeout=5) はループ全体を最大5秒ブロックしていた)。
        self._producer.poll(0)

    async def run(self) -> None:
        """配信レポートを定期的に処理し続けるバックグラウンドループ。

        publish 側の poll(0) だけでも捌けるが、無通信区間でも内部キューを
        確実にドレインするために常駐させる。イベントループはブロックしない。
        """
        while True:
            self._producer.poll(0)
            await asyncio.sleep(0.1)

    def close(self) -> None:
        # 終了時のみ、未送信メッセージを送り切るために同期 flush する。
        self._producer.flush(timeout=10)

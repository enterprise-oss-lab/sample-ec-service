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

            self._producer.produce(
                self._topic,
                key=correlation_id.encode(),
                value=payload,
                headers=headers,
                callback=delivery_report,
            )
            self._producer.flush(timeout=5)

    def close(self) -> None:
        self._producer.flush(timeout=10)

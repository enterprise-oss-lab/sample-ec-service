import logging

from confluent_kafka import Producer

from internal.adapter.kafka.message import ReservationRequest
from internal.usecase.order import KafkaProducerPort

logger = logging.getLogger(__name__)


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

        self._producer.produce(
            self._topic,
            key=correlation_id.encode(),
            value=payload,
            callback=delivery_report,
        )
        self._producer.flush(timeout=5)

    def close(self) -> None:
        self._producer.flush(timeout=10)

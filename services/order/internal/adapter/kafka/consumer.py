import asyncio
import logging

from confluent_kafka import Consumer, KafkaError

from internal.adapter.kafka.message import ReservationResult as KafkaResult
from internal.usecase.order import OrderUsecase, ReservationResult

logger = logging.getLogger(__name__)


class KafkaResultConsumer:
    def __init__(
        self,
        brokers: str,
        topic: str,
        group_id: str,
        usecase: OrderUsecase,
    ) -> None:
        self._consumer = Consumer(
            {
                "bootstrap.servers": brokers,
                "group.id": group_id,
                "auto.offset.reset": "latest",
                "enable.auto.commit": False,
            }
        )
        self._consumer.subscribe([topic])
        self._usecase = usecase

    async def run(self) -> None:
        loop = asyncio.get_running_loop()
        try:
            while True:
                msg = await loop.run_in_executor(None, self._consumer.poll, 0.1)
                if msg is None:
                    await asyncio.sleep(0)
                    continue
                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    logger.error("kafka consumer error: %s", msg.error())
                    continue

                await self._process(msg)
                self._consumer.commit(msg)
        finally:
            self._consumer.close()

    async def _process(self, msg) -> None:
        try:
            result = KafkaResult.model_validate_json(msg.value())
        except Exception as exc:
            logger.error("malformed kafka message key=%s: %s", msg.key(), exc)
            return

        try:
            await self._usecase.handle_reservation_result(
                ReservationResult(
                    correlation_id=result.correlation_id,
                    success=result.success,
                    error=result.error,
                )
            )
        except Exception as exc:
            logger.error("handle reservation result error: %s", exc)

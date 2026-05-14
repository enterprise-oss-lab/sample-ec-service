import asyncio
import logging
import sys

import asyncpg
import uvicorn
from fastapi import FastAPI

from config.config import Settings
from internal.adapter.http.order import create_router
from internal.adapter.kafka.consumer import KafkaResultConsumer
from internal.adapter.kafka.producer import KafkaReservationProducer
from internal.repository.postgres.order import PostgresOrderRepository
from internal.usecase.order import OrderUsecase

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)


async def run() -> None:
    cfg = Settings()

    pool = await asyncpg.create_pool(cfg.database_url)
    if pool is None:
        logger.error("failed to create database pool")
        sys.exit(1)

    repo = PostgresOrderRepository(pool)
    producer = KafkaReservationProducer(
        brokers=cfg.kafka.brokers,
        topic=cfg.kafka.request_topic,
    )
    usecase = OrderUsecase(repo=repo, producer=producer)
    consumer = KafkaResultConsumer(
        brokers=cfg.kafka.brokers,
        topic=cfg.kafka.result_topic,
        group_id=cfg.kafka.consumer_group,
        usecase=usecase,
    )

    app = FastAPI(title="Order Service")
    app.include_router(create_router(usecase), prefix="/order")

    server_config = uvicorn.Config(app, host="0.0.0.0", port=8080, log_level="info")
    server = uvicorn.Server(server_config)

    logger.info("starting order service on :8080")
    try:
        await asyncio.gather(
            server.serve(),
            consumer.run(),
        )
    finally:
        producer.close()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(run())

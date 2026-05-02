from pydantic_settings import BaseSettings, SettingsConfigDict


class KafkaSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KAFKA_")

    brokers: str = "localhost:9092"
    request_topic: str = "inventory.reservation.requests"
    result_topic: str = "inventory.reservation.results"
    consumer_group: str = "order-service"


class Settings(BaseSettings):
    database_url: str = "postgresql://order:password@localhost:5432/order"  # pragma: allowlist secret
    kafka: KafkaSettings = KafkaSettings()

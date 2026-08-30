from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class KafkaSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KAFKA_")

    brokers: str
    request_topic: str = "inventory.reservation.requests"
    result_topic: str = "inventory.reservation.results"
    consumer_group: str = "order-service"


class Settings(BaseSettings):
    model_config = SettingsConfigDict()

    database_url: str = "postgresql://order:password@localhost:5432/order"  # pragma: allowlist secret
    kafka: KafkaSettings = Field(default_factory=KafkaSettings)
    # CORS 許可オリジン。カンマ区切りで複数指定可（例: dev の 5173 と compose の 3001）。
    cors_origins: str = "http://localhost:5173"

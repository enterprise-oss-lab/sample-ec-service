from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OrderError(Exception):
    pass


class NotFoundError(OrderError):
    pass


class InvalidStatusTransitionError(OrderError):
    pass


@dataclass
class OrderItem:
    inventory_id: int
    quantity: int


@dataclass
class Order:
    id: str
    customer_id: str
    items: list[OrderItem]
    status: OrderStatus
    correlation_id: str
    created_at: datetime
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def confirm(self) -> None:
        if self.status != OrderStatus.PENDING:
            raise InvalidStatusTransitionError(
                f"cannot confirm order in status '{self.status}'"
            )
        self.status = OrderStatus.CONFIRMED
        self.updated_at = datetime.now(timezone.utc)

    def fail(self) -> None:
        if self.status != OrderStatus.PENDING:
            raise InvalidStatusTransitionError(
                f"cannot fail order in status '{self.status}'"
            )
        self.status = OrderStatus.FAILED
        self.updated_at = datetime.now(timezone.utc)

    def cancel(self) -> None:
        if self.status != OrderStatus.PENDING:
            raise InvalidStatusTransitionError(
                f"cannot cancel order in status '{self.status}'"
            )
        self.status = OrderStatus.CANCELLED
        self.updated_at = datetime.now(timezone.utc)

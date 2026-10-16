from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


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
    unit_price_at_order: int
    id: int | None = None


@dataclass(frozen=True)
class OrderConfirmedEvent:
    event_id: str
    occurred_at: datetime
    order_id: str
    items: list[OrderItem]

    def payload(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": "order_confirmed",
            "occurred_at": self.occurred_at.isoformat().replace("+00:00", "Z"),
            "order_id": self.order_id,
            "items": [
                {
                    "order_item_id": item.id,
                    "inventory_id": item.inventory_id,
                    "quantity": item.quantity,
                    "unit_price_at_order": item.unit_price_at_order,
                    "net_amount": item.quantity * item.unit_price_at_order,
                }
                for item in self.items
            ],
        }


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

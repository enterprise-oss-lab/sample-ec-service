import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from internal.domain.order import Order, OrderItem, OrderStatus
from internal.domain.repository import OrderRepository


class KafkaProducerPort(ABC):
    @abstractmethod
    async def publish_reservation_request(
        self,
        correlation_id: str,
        inventory_id: int,
        quantity: int,
    ) -> None: ...


class ReservationResult:
    def __init__(self, correlation_id: str, success: bool, error: str = "") -> None:
        self.correlation_id = correlation_id
        self.success = success
        self.error = error


class OrderUsecase:
    def __init__(self, repo: OrderRepository, producer: KafkaProducerPort) -> None:
        self._repo = repo
        self._producer = producer

    async def create_order(
        self,
        customer_id: str,
        items: list[OrderItem],
    ) -> Order:
        if not items:
            raise ValueError("order must have at least one item")
        for item in items:
            if item.quantity <= 0:
                raise ValueError("quantity must be greater than 0")

        order_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        order = Order(
            id=order_id,
            customer_id=customer_id,
            items=items,
            status=OrderStatus.PENDING,
            correlation_id=order_id,
            created_at=now,
            updated_at=now,
        )
        await self._repo.save(order)

        # Publish one reservation request per item. For simplicity, this sample
        # uses the first item's inventory_id and quantity for the correlation key.
        # A production system would track per-item correlation.
        first_item = items[0]
        await self._producer.publish_reservation_request(
            correlation_id=order_id,
            inventory_id=first_item.inventory_id,
            quantity=first_item.quantity,
        )
        return order

    async def list_orders(self, customer_id: str | None = None) -> list[Order]:
        return await self._repo.list_all(customer_id=customer_id)

    async def get_order(self, id: str) -> Order:
        return await self._repo.find_by_id(id)

    async def cancel_order(self, id: str) -> None:
        order = await self._repo.find_by_id(id)
        order.cancel()
        await self._repo.save(order)

    async def handle_reservation_result(self, result: ReservationResult) -> None:
        order = await self._repo.find_by_correlation_id(result.correlation_id)
        if result.success:
            order.confirm()
        else:
            order.fail()
        await self._repo.save(order)

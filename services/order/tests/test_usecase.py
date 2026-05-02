from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from internal.domain.order import (
    InvalidStatusTransitionError,
    NotFoundError,
    Order,
    OrderItem,
    OrderStatus,
)
from internal.usecase.order import KafkaProducerPort, OrderUsecase, ReservationResult


def make_pending_order(order_id: str = "order-1") -> Order:
    now = datetime.now(timezone.utc)
    return Order(
        id=order_id,
        customer_id="customer-1",
        items=[OrderItem(inventory_id=1, quantity=2)],
        status=OrderStatus.PENDING,
        correlation_id=order_id,
        created_at=now,
        updated_at=now,
    )


def make_usecase(repo=None, producer=None) -> OrderUsecase:
    if repo is None:
        repo = AsyncMock()
    if producer is None:
        producer = AsyncMock(spec=KafkaProducerPort)
    return OrderUsecase(repo=repo, producer=producer)


class TestCreateOrder:
    async def test_saves_order_and_publishes(self):
        repo = AsyncMock()
        producer = AsyncMock(spec=KafkaProducerPort)
        uc = make_usecase(repo=repo, producer=producer)

        order = await uc.create_order(
            customer_id="c1",
            items=[OrderItem(inventory_id=1, quantity=3)],
        )

        assert order.status == OrderStatus.PENDING
        assert order.customer_id == "c1"
        repo.save.assert_awaited_once()
        producer.publish_reservation_request.assert_awaited_once_with(
            correlation_id=order.id,
            inventory_id=1,
            quantity=3,
        )

    async def test_empty_items_raises(self):
        uc = make_usecase()
        with pytest.raises(ValueError, match="at least one item"):
            await uc.create_order(customer_id="c1", items=[])

    async def test_zero_quantity_raises(self):
        uc = make_usecase()
        with pytest.raises(ValueError, match="quantity must be greater than 0"):
            await uc.create_order(customer_id="c1", items=[OrderItem(inventory_id=1, quantity=0)])


class TestGetOrder:
    async def test_returns_order(self):
        order = make_pending_order()
        repo = AsyncMock()
        repo.find_by_id.return_value = order
        uc = make_usecase(repo=repo)

        result = await uc.get_order("order-1")
        assert result.id == "order-1"
        repo.find_by_id.assert_awaited_once_with("order-1")

    async def test_not_found_propagates(self):
        repo = AsyncMock()
        repo.find_by_id.side_effect = NotFoundError("not found")
        uc = make_usecase(repo=repo)

        with pytest.raises(NotFoundError):
            await uc.get_order("missing")


class TestCancelOrder:
    async def test_cancels_pending_order(self):
        order = make_pending_order()
        repo = AsyncMock()
        repo.find_by_id.return_value = order
        uc = make_usecase(repo=repo)

        await uc.cancel_order("order-1")

        assert order.status == OrderStatus.CANCELLED
        repo.save.assert_awaited_once_with(order)

    async def test_cannot_cancel_confirmed_order(self):
        order = make_pending_order()
        order.confirm()
        repo = AsyncMock()
        repo.find_by_id.return_value = order
        uc = make_usecase(repo=repo)

        with pytest.raises(InvalidStatusTransitionError):
            await uc.cancel_order("order-1")


class TestHandleReservationResult:
    async def test_confirms_order_on_success(self):
        order = make_pending_order()
        repo = AsyncMock()
        repo.find_by_correlation_id.return_value = order
        uc = make_usecase(repo=repo)

        await uc.handle_reservation_result(
            ReservationResult(correlation_id="order-1", success=True)
        )

        assert order.status == OrderStatus.CONFIRMED
        repo.save.assert_awaited_once_with(order)

    async def test_fails_order_on_failure(self):
        order = make_pending_order()
        repo = AsyncMock()
        repo.find_by_correlation_id.return_value = order
        uc = make_usecase(repo=repo)

        await uc.handle_reservation_result(
            ReservationResult(correlation_id="order-1", success=False, error="insufficient stock")
        )

        assert order.status == OrderStatus.FAILED
        repo.save.assert_awaited_once_with(order)

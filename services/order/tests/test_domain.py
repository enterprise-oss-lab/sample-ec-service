from datetime import datetime, timezone

import pytest

from internal.domain.order import (
    InvalidStatusTransitionError,
    Order,
    OrderItem,
    OrderStatus,
)


def make_order(status: OrderStatus = OrderStatus.PENDING) -> Order:
    now = datetime.now(timezone.utc)
    return Order(
        id="order-1",
        customer_id="customer-1",
        items=[OrderItem(inventory_id=1, quantity=2)],
        status=status,
        correlation_id="order-1",
        created_at=now,
        updated_at=now,
    )


class TestConfirm:
    def test_pending_to_confirmed(self):
        order = make_order(OrderStatus.PENDING)
        order.confirm()
        assert order.status == OrderStatus.CONFIRMED

    def test_cannot_confirm_confirmed(self):
        order = make_order(OrderStatus.CONFIRMED)
        with pytest.raises(InvalidStatusTransitionError):
            order.confirm()

    def test_cannot_confirm_cancelled(self):
        order = make_order(OrderStatus.CANCELLED)
        with pytest.raises(InvalidStatusTransitionError):
            order.confirm()

    def test_cannot_confirm_failed(self):
        order = make_order(OrderStatus.FAILED)
        with pytest.raises(InvalidStatusTransitionError):
            order.confirm()


class TestFail:
    def test_pending_to_failed(self):
        order = make_order(OrderStatus.PENDING)
        order.fail()
        assert order.status == OrderStatus.FAILED

    def test_cannot_fail_confirmed(self):
        order = make_order(OrderStatus.CONFIRMED)
        with pytest.raises(InvalidStatusTransitionError):
            order.fail()

    def test_cannot_fail_cancelled(self):
        order = make_order(OrderStatus.CANCELLED)
        with pytest.raises(InvalidStatusTransitionError):
            order.fail()


class TestCancel:
    def test_pending_to_cancelled(self):
        order = make_order(OrderStatus.PENDING)
        order.cancel()
        assert order.status == OrderStatus.CANCELLED

    def test_cannot_cancel_confirmed(self):
        order = make_order(OrderStatus.CONFIRMED)
        with pytest.raises(InvalidStatusTransitionError):
            order.cancel()

    def test_cannot_cancel_failed(self):
        order = make_order(OrderStatus.FAILED)
        with pytest.raises(InvalidStatusTransitionError):
            order.cancel()

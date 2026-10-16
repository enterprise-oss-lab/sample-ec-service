from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from internal.domain.order import Order, OrderConfirmedEvent, OrderItem, OrderStatus
from internal.repository.postgres.order import PostgresOrderRepository


def make_order() -> Order:
    now = datetime.now(timezone.utc)
    return Order(
        id="00000000-0000-0000-0000-000000000001",
        customer_id="customer-1",
        items=[OrderItem(inventory_id=10, quantity=2, unit_price_at_order=1000, id=1)],
        status=OrderStatus.PENDING,
        correlation_id="00000000-0000-0000-0000-000000000001",
        created_at=now,
        updated_at=now,
    )


def make_repo(inserted_id):
    conn = MagicMock()
    conn.fetchval = AsyncMock(return_value=inserted_id)
    conn.execute = AsyncMock()
    conn.executemany = AsyncMock()
    transaction = MagicMock()
    transaction.__aenter__ = AsyncMock()
    transaction.__aexit__ = AsyncMock(return_value=False)
    conn.transaction.return_value = transaction
    acquire = MagicMock()
    acquire.__aenter__ = AsyncMock(return_value=conn)
    acquire.__aexit__ = AsyncMock(return_value=False)
    pool = MagicMock()
    pool.acquire.return_value = acquire
    return PostgresOrderRepository(pool), conn


async def test_save_inserts_items_for_new_order():
    order = make_order()
    repo, conn = make_repo(order.id)

    await repo.save(order)

    conn.executemany.assert_awaited_once()
    assert conn.executemany.await_args.args[1] == [(order.id, 10, 2, 1000)]


async def test_save_updates_only_order_for_existing_order():
    order = make_order()
    order.confirm()
    repo, conn = make_repo(None)

    await repo.save(order)

    conn.execute.assert_awaited_once_with(
        "UPDATE orders SET status = $2, updated_at = $3 WHERE id = $1",
        order.id,
        OrderStatus.CONFIRMED.value,
        order.updated_at,
    )
    conn.executemany.assert_not_awaited()


async def test_save_confirmation_updates_status_and_inserts_outbox_in_one_transaction():
    order = make_order()
    order.confirm()
    repo, conn = make_repo(order.id)
    event = OrderConfirmedEvent("event-1", order.updated_at, order.id, order.items)

    saved = await repo.save_confirmation(order, event)

    assert saved is True
    assert conn.fetchval.await_count == 1
    conn.execute.assert_awaited_once()
    payload = conn.execute.await_args.args[4]
    assert '"net_amount": 2000' in payload
    conn.transaction.return_value.__aenter__.assert_awaited_once()
    conn.transaction.return_value.__aexit__.assert_awaited_once()


async def test_save_confirmation_skips_outbox_when_order_is_no_longer_pending():
    order = make_order()
    order.confirm()
    repo, conn = make_repo(None)
    event = OrderConfirmedEvent("event-1", order.updated_at, order.id, order.items)

    saved = await repo.save_confirmation(order, event)

    assert saved is False
    conn.execute.assert_not_awaited()


async def test_save_confirmation_rolls_back_when_outbox_insert_fails():
    order = make_order()
    order.confirm()
    repo, conn = make_repo(order.id)
    conn.execute.side_effect = RuntimeError("outbox insert failed")
    event = OrderConfirmedEvent("event-1", order.updated_at, order.id, order.items)

    with pytest.raises(RuntimeError, match="outbox insert failed"):
        await repo.save_confirmation(order, event)

    exit_args = conn.transaction.return_value.__aexit__.await_args.args
    assert exit_args[0] is RuntimeError

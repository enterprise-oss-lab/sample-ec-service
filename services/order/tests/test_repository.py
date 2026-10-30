from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from internal.domain.order import Order, OrderItem, OrderStatus
from internal.repository.postgres.order import PostgresOrderRepository


def make_order() -> Order:
    now = datetime.now(timezone.utc)
    return Order(
        id="00000000-0000-0000-0000-000000000001",
        customer_id="customer-1",
        items=[OrderItem(inventory_id=10, quantity=2, unit_price_at_order=1000)],
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
    transaction.__aexit__ = AsyncMock()
    conn.transaction.return_value = transaction
    acquire = MagicMock()
    acquire.__aenter__ = AsyncMock(return_value=conn)
    acquire.__aexit__ = AsyncMock()
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

from datetime import timezone

import asyncpg

from internal.domain.order import NotFoundError, Order, OrderItem, OrderStatus
from internal.domain.repository import OrderRepository


class PostgresOrderRepository(OrderRepository):
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def save(self, order: Order) -> None:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO orders (id, customer_id, status, correlation_id, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id) DO UPDATE
                        SET status     = EXCLUDED.status,
                            updated_at = EXCLUDED.updated_at
                    """,
                    order.id,
                    order.customer_id,
                    order.status.value,
                    order.correlation_id,
                    order.created_at,
                    order.updated_at,
                )
                await conn.execute(
                    "DELETE FROM order_items WHERE order_id = $1",
                    order.id,
                )
                await conn.executemany(
                    "INSERT INTO order_items (order_id, inventory_id, quantity) VALUES ($1, $2, $3)",
                    [(order.id, item.inventory_id, item.quantity) for item in order.items],
                )

    async def find_by_id(self, id: str) -> Order:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, customer_id, status, correlation_id, created_at, updated_at FROM orders WHERE id = $1",
                id,
            )
            if row is None:
                raise NotFoundError(f"order {id} not found")
            return await self._row_to_order(conn, row)

    async def find_by_correlation_id(self, correlation_id: str) -> Order:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, customer_id, status, correlation_id, created_at, updated_at FROM orders WHERE correlation_id = $1",
                correlation_id,
            )
            if row is None:
                raise NotFoundError(f"order with correlation_id {correlation_id} not found")
            return await self._row_to_order(conn, row)

    async def _row_to_order(self, conn: asyncpg.Connection, row: asyncpg.Record) -> Order:
        item_rows = await conn.fetch(
            "SELECT inventory_id, quantity FROM order_items WHERE order_id = $1 ORDER BY id",
            row["id"],
        )
        items = [OrderItem(inventory_id=r["inventory_id"], quantity=r["quantity"]) for r in item_rows]

        created_at = row["created_at"]
        updated_at = row["updated_at"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)

        return Order(
            id=str(row["id"]),
            customer_id=row["customer_id"],
            items=items,
            status=OrderStatus(row["status"]),
            correlation_id=row["correlation_id"],
            created_at=created_at,
            updated_at=updated_at,
        )

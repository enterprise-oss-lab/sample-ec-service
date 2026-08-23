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
            items_by_order = await self._fetch_items(conn, [row["id"]])
            return self._build_order(row, items_by_order.get(row["id"], []))

    async def list_all(
        self, customer_id: str | None = None, limit: int = 100
    ) -> list[Order]:
        async with self._pool.acquire() as conn:
            # 直近 limit 件のみ取得する。以前は LIMIT 無しで全件返しており、注文が
            # 増えるほど GET /orders が重くなり pool 接続を長時間占有していた。
            if customer_id is not None:
                rows = await conn.fetch(
                    "SELECT id, customer_id, status, correlation_id, created_at, updated_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2",
                    customer_id,
                    limit,
                )
            else:
                rows = await conn.fetch(
                    "SELECT id, customer_id, status, correlation_id, created_at, updated_at FROM orders ORDER BY created_at DESC LIMIT $1",
                    limit,
                )
            if not rows:
                return []
            # 全注文の items を1クエリでまとめて取得する (以前は注文ごとに1クエリ発行する
            # N+1 だったため、注文が増えるほど list_all が遅くなり、pool 接続を長時間占有して
            # 他リクエストを詰まらせていた)。
            items_by_order = await self._fetch_items(conn, [row["id"] for row in rows])
            return [self._build_order(row, items_by_order.get(row["id"], [])) for row in rows]

    async def find_by_correlation_id(self, correlation_id: str) -> Order:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, customer_id, status, correlation_id, created_at, updated_at FROM orders WHERE correlation_id = $1",
                correlation_id,
            )
            if row is None:
                raise NotFoundError(f"order with correlation_id {correlation_id} not found")
            items_by_order = await self._fetch_items(conn, [row["id"]])
            return self._build_order(row, items_by_order.get(row["id"], []))

    async def _fetch_items(
        self, conn: asyncpg.Connection, order_ids: list
    ) -> dict:
        """複数注文の order_items を1クエリで取得し、order_id ごとにまとめて返す。"""
        rows = await conn.fetch(
            "SELECT order_id, inventory_id, quantity FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY id",
            order_ids,
        )
        items_by_order: dict = {}
        for r in rows:
            items_by_order.setdefault(r["order_id"], []).append(
                OrderItem(inventory_id=r["inventory_id"], quantity=r["quantity"])
            )
        return items_by_order

    def _build_order(self, row: asyncpg.Record, items: list[OrderItem]) -> Order:
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

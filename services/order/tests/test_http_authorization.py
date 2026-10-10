from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from internal.adapter.http.auth import TokenValidator, current_subject
from internal.adapter.http.order import create_router
from internal.domain.order import Order, OrderItem, OrderStatus


class FakeOrderUsecase:
    def __init__(self) -> None:
        now = datetime.now(timezone.utc)
        self.order = Order(
            id="owner-order",
            customer_id="owner-subject",
            items=[OrderItem(inventory_id=1, quantity=1)],
            status=OrderStatus.PENDING,
            correlation_id="correlation-id",
            created_at=now,
            updated_at=now,
        )
        self.list_customer_id: str | None = None
        self.created_customer_id: str | None = None

    async def list_orders(self, customer_id: str, limit: int):
        self.list_customer_id = customer_id
        return [self.order] if customer_id == self.order.customer_id else []

    async def create_order(self, customer_id: str, items: list[OrderItem]):
        self.created_customer_id = customer_id
        return self.order

    async def get_order(self, order_id: str):
        return self.order

    async def cancel_order(self, order_id: str):
        return None


def client_for(subject: str) -> tuple[TestClient, FakeOrderUsecase]:
    usecase = FakeOrderUsecase()
    app = FastAPI()
    app.include_router(create_router(usecase))
    app.dependency_overrides[current_subject] = lambda: subject
    return TestClient(app), usecase


def test_missing_bearer_token_is_unauthorized() -> None:
    validator = TokenValidator("https://issuer.example", "storefront-client")

    try:
        validator.subject(None)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 401
    else:
        raise AssertionError("missing Authorization header must be rejected")


def test_orders_are_scoped_to_authenticated_subject() -> None:
    client, usecase = client_for("owner-subject")

    response = client.get("/orders")

    assert response.status_code == 200
    assert usecase.list_customer_id == "owner-subject"
    assert response.json()[0]["customer_id"] == "owner-subject"


def test_create_order_uses_authenticated_subject_not_request_body() -> None:
    client, usecase = client_for("owner-subject")

    response = client.post("/orders", json={"items": [{"inventory_id": 1, "quantity": 1}]})

    assert response.status_code == 201
    assert usecase.created_customer_id == "owner-subject"


def test_non_owner_cannot_read_or_cancel_order() -> None:
    client, _ = client_for("other-subject")

    assert client.get("/orders/owner-order").status_code == 404
    assert client.post("/orders/owner-order/cancel").status_code == 404

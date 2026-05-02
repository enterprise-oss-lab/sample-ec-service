from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from internal.domain.order import InvalidStatusTransitionError, NotFoundError, OrderItem
from internal.usecase.order import OrderUsecase

router = APIRouter(prefix="/orders")


class OrderItemRequest(BaseModel):
    inventory_id: int
    quantity: int


class CreateOrderRequest(BaseModel):
    customer_id: str
    items: list[OrderItemRequest]


class OrderItemResponse(BaseModel):
    inventory_id: int
    quantity: int


class OrderResponse(BaseModel):
    id: str
    customer_id: str
    items: list[OrderItemResponse]
    status: str
    correlation_id: str
    created_at: str
    updated_at: str


def create_router(usecase: OrderUsecase) -> APIRouter:
    @router.post("", status_code=status.HTTP_201_CREATED, response_model=OrderResponse)
    async def create_order(req: CreateOrderRequest) -> OrderResponse:
        try:
            order = await usecase.create_order(
                customer_id=req.customer_id,
                items=[OrderItem(inventory_id=i.inventory_id, quantity=i.quantity) for i in req.items],
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
        return _to_response(order)

    @router.get("/{id}", response_model=OrderResponse)
    async def get_order(id: str) -> OrderResponse:
        try:
            order = await usecase.get_order(id)
        except NotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        return _to_response(order)

    @router.post("/{id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
    async def cancel_order(id: str) -> None:
        try:
            await usecase.cancel_order(id)
        except NotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        except InvalidStatusTransitionError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    return router


def _to_response(order) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        customer_id=order.customer_id,
        items=[OrderItemResponse(inventory_id=i.inventory_id, quantity=i.quantity) for i in order.items],
        status=order.status.value,
        correlation_id=order.correlation_id,
        created_at=order.created_at.isoformat(),
        updated_at=order.updated_at.isoformat(),
    )

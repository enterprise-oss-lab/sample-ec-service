from pydantic import BaseModel


class ReservationRequest(BaseModel):
    correlation_id: str
    inventory_id: int
    quantity: int


class ReservationResult(BaseModel):
    correlation_id: str
    inventory_id: int
    quantity: int
    success: bool
    error: str = ""

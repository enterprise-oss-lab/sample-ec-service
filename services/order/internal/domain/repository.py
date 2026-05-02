from abc import ABC, abstractmethod

from internal.domain.order import Order


class OrderRepository(ABC):
    @abstractmethod
    async def save(self, order: Order) -> None: ...

    @abstractmethod
    async def find_by_id(self, id: str) -> Order: ...

    @abstractmethod
    async def find_by_correlation_id(self, correlation_id: str) -> Order: ...

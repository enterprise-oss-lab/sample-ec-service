import httpx

from internal.usecase.order import CatalogUnavailableError, ProductNotFoundError


class InventoryProductCatalog:
    def __init__(self, base_url: str) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=5.0)

    async def get_unit_price(self, inventory_id: int) -> int:
        try:
            response = await self._client.get(f"/products/{inventory_id}")
        except httpx.HTTPError as exc:
            raise CatalogUnavailableError("product catalog is unavailable") from exc
        if response.status_code == 404:
            raise ProductNotFoundError(f"product {inventory_id} not found")
        if response.is_error:
            raise CatalogUnavailableError("product catalog is unavailable")
        try:
            return int(response.json()["price"])
        except (KeyError, TypeError, ValueError) as exc:
            raise CatalogUnavailableError("product catalog returned an invalid price") from exc

    async def close(self) -> None:
        await self._client.aclose()

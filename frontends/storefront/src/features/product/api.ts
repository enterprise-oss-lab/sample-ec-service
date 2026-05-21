type InventoryItem = {
  id: number
  name: string
  count: number
}

export type Product = {
  id: number
  name: string
  count: number
  price: number
  imageUrl: string
}

const INVENTORY_API_BASE_URL = import.meta.env.VITE_INVENTORY_API_BASE_URL ?? ''

function toProduct(item: InventoryItem): Product {
  return {
    ...item,
    price: 0,
    imageUrl: 'https://placehold.co/400x300',
  }
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/inventories`)
  if (!res.ok) throw new Error('Failed to fetch products')
  const items: InventoryItem[] = await res.json()
  return items.map(toProduct)
}

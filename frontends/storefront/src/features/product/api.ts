import { imageUrl } from '@/shared/imageUrl'

type InventoryItem = {
  id: number
  name: string
  count: number
  price: number
  description: string
  image_key: string | null
}

export type Product = {
  id: number
  name: string
  count: number
  price: number
  description: string
  imageUrl: string | null
}

const INVENTORY_API_BASE_URL = import.meta.env.VITE_INVENTORY_API_BASE_URL ?? ''

function toProduct(item: InventoryItem): Product {
  return {
    id: item.id,
    name: item.name,
    count: item.count,
    price: item.price,
    description: item.description,
    imageUrl: imageUrl(item.image_key),
  }
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/inventories`)
  if (!res.ok) throw new Error('Failed to fetch products')
  const items: InventoryItem[] = await res.json()
  return items.map(toProduct)
}

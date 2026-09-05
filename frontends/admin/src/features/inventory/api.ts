type InventoryResponse = {
  id: number
  name: string
  count: number
  price: number
  description: string
  image_key: string | null
  created_at: string
  updated_at: string
}

export type Inventory = {
  id: number
  name: string
  count: number
  price: number
  description: string
  imageKey: string | null
  createdAt: string
  updatedAt: string
}

const INVENTORY_API_BASE_URL = import.meta.env.VITE_INVENTORY_API_BASE_URL ?? ''

function toInventory(item: InventoryResponse): Inventory {
  return {
    id: item.id,
    name: item.name,
    count: item.count,
    price: item.price,
    description: item.description,
    imageKey: item.image_key,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }
}

export async function fetchInventories(): Promise<Inventory[]> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/inventories`)
  if (!res.ok) throw new Error('Failed to fetch inventories')
  const items: InventoryResponse[] = await res.json()
  return items.map(toInventory)
}

export async function fetchInventory(id: number): Promise<Inventory> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/inventories/${id}`)
  if (!res.ok) throw new Error('Failed to fetch inventory')
  const item: InventoryResponse = await res.json()
  return toInventory(item)
}

export async function adjustStock(id: number, delta: number): Promise<void> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/admin/inventories/${id}/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? 'Failed to adjust stock')
  }
}

export type CreateProductRequest = {
  name: string
  price: number
  description: string
  image_key: string | null
  count: number
}

export type UpdateProductRequest = {
  name: string
  price: number
  description: string
  image_key: string | null
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  return body?.error ?? fallback
}

export async function createProduct(req: CreateProductRequest): Promise<Inventory> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/admin/inventories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to create product'))
  const item: InventoryResponse = await res.json()
  return toInventory(item)
}

export async function updateProduct(id: number, req: UpdateProductRequest): Promise<Inventory> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/admin/inventories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to update product'))
  const item: InventoryResponse = await res.json()
  return toInventory(item)
}

export async function deleteProduct(id: number): Promise<void> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/admin/inventories/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to delete product'))
}

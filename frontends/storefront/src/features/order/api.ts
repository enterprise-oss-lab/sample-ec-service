const ORDER_API_BASE_URL = import.meta.env.VITE_ORDER_API_BASE_URL ?? ''

export type OrderItem = {
  inventory_id: number
  quantity: number
}

export type Order = {
  id: string
  customer_id: string
  items: OrderItem[]
  status: string
  correlation_id: string
  created_at: string
  updated_at: string
}

export type CreateOrderRequest = {
  customer_id: string
  items: { inventory_id: number; quantity: number }[]
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${ORDER_API_BASE_URL}/orders`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to fetch orders')
  return res.json()
}

export async function createOrder(req: CreateOrderRequest): Promise<void> {
  const res = await fetch(`${ORDER_API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error('Failed to create order')
}

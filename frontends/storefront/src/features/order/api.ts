const ORDER_API_BASE_URL = import.meta.env.VITE_ORDER_API_BASE_URL ?? ''

export type CreateOrderRequest = {
  customer_id: string
  items: { inventory_id: number; quantity: number }[]
}

export async function createOrder(req: CreateOrderRequest): Promise<void> {
  const res = await fetch(`${ORDER_API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error('Failed to create order')
}

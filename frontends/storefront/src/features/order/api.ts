import { authorizationHeader } from '@/auth/oidc'

const ORDER_API_BASE_URL = import.meta.env.VITE_ORDER_API_BASE_URL ?? ''

export type OrderItem = {
  inventory_id: number
  quantity: number
  unit_price_at_order: number
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
  items: { inventory_id: number; quantity: number; expected_unit_price: number }[]
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${ORDER_API_BASE_URL}/orders`, {
    headers: { accept: 'application/json', ...authorizationHeader() },
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      window.dispatchEvent(
        new CustomEvent('sample-ec:auth-error', { detail: res.status }),
      )
    throw new Error('Failed to fetch orders')
  }
  return res.json()
}

export async function createOrder(req: CreateOrderRequest): Promise<void> {
  const res = await fetch(`${ORDER_API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authorizationHeader() },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      window.dispatchEvent(
        new CustomEvent('sample-ec:auth-error', { detail: res.status }),
      )
    if (res.status === 409)
      throw new Error('価格が変更されました。商品を再読み込みして確認してください')
    throw new Error('注文に失敗しました')
  }
}

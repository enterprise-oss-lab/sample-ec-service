import { http, HttpResponse } from 'msw'

// カタログ (products) と在庫 (inventories) は別エンドポイント。
// 同じ id で突き合わせる前提のモックデータにしてある。
const products = [
  {
    id: 1,
    name: 'Product A',
    description: 'Product A の説明文',
    price: 1200,
    image_key: 'products/product-a.jpg',
  },
  {
    id: 2,
    name: 'Out of Stock',
    description: '在庫切れ商品の説明文',
    price: 3400,
    image_key: null,
  },
]

export const handlers = [
  http.get(/\/products\/(\d+)$/, ({ request }) => {
    const id = Number(new URL(request.url).pathname.split('/').pop())
    const product = products.find((p) => p.id === id)
    return product
      ? HttpResponse.json(product)
      : HttpResponse.json({ error: 'product not found' }, { status: 404 })
  }),
  http.get(/\/products$/, () => HttpResponse.json(products)),
  http.get(/\/inventories\/(\d+)$/, ({ request }) => {
    const id = Number(new URL(request.url).pathname.split('/').pop())
    const stocks: Record<number, { id: number; count: number }> = {
      1: { id: 1, count: 5 },
      2: { id: 2, count: 0 },
    }
    return stocks[id]
      ? HttpResponse.json(stocks[id])
      : HttpResponse.json({ error: 'inventory not found' }, { status: 404 })
  }),
  http.get(/\/inventories$/, () =>
    HttpResponse.json([
      { id: 1, count: 5 },
      { id: 2, count: 0 },
    ]),
  ),
  http.get(/\/orders$/, () =>
    HttpResponse.json([
      {
        id: 'order-1',
        customer_id: 'guest',
        items: [{ inventory_id: 1, quantity: 2 }],
        status: 'pending',
        correlation_id: 'corr-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'order-2',
        customer_id: 'guest',
        items: [{ inventory_id: 2, quantity: 1 }],
        status: 'delivered',
        correlation_id: 'corr-2',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ]),
  ),
  http.post(/\/orders$/, () =>
    HttpResponse.json({ id: 'order-new' }, { status: 201 }),
  ),
]

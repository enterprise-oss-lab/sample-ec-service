import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get(/\/inventories$/, () =>
    HttpResponse.json([
      {
        id: 1,
        name: 'Product A',
        count: 5,
        price: 1000,
        description: 'Product A の説明',
        image_key: 'products/product-a.jpg',
      },
      {
        id: 2,
        name: 'Out of Stock',
        count: 0,
        price: 2000,
        description: 'Out of Stock の説明',
        image_key: null,
      },
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

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
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        name: 'Out of Stock',
        count: 0,
        price: 2000,
        description: 'Out of Stock の説明',
        image_key: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]),
  ),
  http.post(/\/admin\/inventories\/\d+\/adjust$/, () => new HttpResponse(null, { status: 204 })),
]

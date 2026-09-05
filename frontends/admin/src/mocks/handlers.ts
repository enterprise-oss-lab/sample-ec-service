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
  http.get(/\/inventories\/\d+$/, () =>
    HttpResponse.json({
      id: 1,
      name: 'Product A',
      count: 5,
      price: 1000,
      description: 'Product A の説明',
      image_key: 'products/product-a.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }),
  ),
  http.post(/\/admin\/inventories$/, () =>
    HttpResponse.json(
      {
        id: 3,
        name: 'New Product',
        count: 10,
        price: 500,
        description: '',
        image_key: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      { status: 201 },
    ),
  ),
  http.put(/\/admin\/inventories\/\d+$/, () =>
    HttpResponse.json({
      id: 1,
      name: 'Updated Product',
      count: 5,
      price: 1500,
      description: '更新済み',
      image_key: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }),
  ),
  http.delete(/\/admin\/inventories\/\d+$/, () => new HttpResponse(null, { status: 204 })),
  http.post(/\/admin\/images$/, () =>
    HttpResponse.json({ image_key: 'products/mock-uuid.jpg' }, { status: 201 }),
  ),
]

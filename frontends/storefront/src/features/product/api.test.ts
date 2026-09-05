import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchProducts } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchProducts', () => {
  it('正常レスポンスで Product[] を返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 1, name: 'Product A', count: 5, price: 1000, description: '説明A', image_key: 'products/a.jpg' },
        { id: 2, name: 'Out of Stock', count: 0, price: 2000, description: '説明B', image_key: null },
      ]),
    }))

    const products = await fetchProducts()

    expect(products).toHaveLength(2)
    expect(products[0]).toMatchObject({
      id: 1,
      name: 'Product A',
      count: 5,
      price: 1000,
      description: '説明A',
      imageUrl: `${import.meta.env.VITE_IMAGE_BASE_URL ?? ''}/products/a.jpg`,
    })
    expect(products[1]).toMatchObject({
      id: 2,
      name: 'Out of Stock',
      count: 0,
      price: 2000,
      description: '説明B',
      imageUrl: null,
    })
  })

  it('res.ok === false で Error を throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(fetchProducts()).rejects.toThrow('Failed to fetch products')
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchProduct, fetchProducts, fetchStock, fetchStocks } from './api'

function stubFetch(body: unknown, ok = true, status = ok ? 200 : 500) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const productResponse = {
  id: 1,
  name: 'Product A',
  description: 'Product A の説明文',
  price: 1200,
  image_key: 'products/a.png',
}

describe('fetchProducts', () => {
  it('カタログ API (/products) を叩く', async () => {
    const fetchMock = stubFetch([productResponse])
    await fetchProducts()
    expect(fetchMock).toHaveBeenCalledWith('/products')
  })

  it('image_key を imageUrl にマップして返す', async () => {
    stubFetch([productResponse])

    const products = await fetchProducts()

    expect(products).toHaveLength(1)
    expect(products[0]).toEqual({
      id: 1,
      name: 'Product A',
      description: 'Product A の説明文',
      price: 1200,
      imageUrl: `${import.meta.env.VITE_IMAGE_BASE_URL ?? ''}/products/a.png`,
    })
  })

  it('在庫数は含まない (在庫は別リソース)', async () => {
    stubFetch([productResponse])
    const products = await fetchProducts()
    expect(products[0]).not.toHaveProperty('count')
  })

  it('res.ok === false で Error を throw する', async () => {
    stubFetch(null, false)
    await expect(fetchProducts()).rejects.toThrow('Failed to fetch products')
  })
})

describe('fetchProduct', () => {
  it('id 付きのカタログ API を叩く', async () => {
    const fetchMock = stubFetch(productResponse)
    const product = await fetchProduct(1)
    expect(fetchMock).toHaveBeenCalledWith('/products/1')
    expect(product?.imageUrl).toBe(`${import.meta.env.VITE_IMAGE_BASE_URL ?? ''}/products/a.png`)
  })

  it('404 は null を返す (throw しない)', async () => {
    stubFetch({ error: 'product not found' }, false, 404)
    await expect(fetchProduct(9999)).resolves.toBeNull()
  })

  it('404 以外の失敗では Error を throw する', async () => {
    stubFetch(null, false, 500)
    await expect(fetchProduct(1)).rejects.toThrow('Failed to fetch product')
  })
})

describe('fetchStocks', () => {
  it('在庫 API (/inventories) を叩く', async () => {
    const fetchMock = stubFetch([{ id: 1, name: 'Product A', count: 5 }])
    const stocks = await fetchStocks()
    expect(fetchMock).toHaveBeenCalledWith('/inventories')
    expect(stocks[0].count).toBe(5)
  })

  it('res.ok === false で Error を throw する', async () => {
    stubFetch(null, false)
    await expect(fetchStocks()).rejects.toThrow('Failed to fetch stocks')
  })
})

describe('fetchStock', () => {
  it('id 付きの在庫 API を叩く', async () => {
    const fetchMock = stubFetch({ id: 1, name: 'Product A', count: 5 })
    const stock = await fetchStock(1)
    expect(fetchMock).toHaveBeenCalledWith('/inventories/1')
    expect(stock.count).toBe(5)
  })

  it('res.ok === false で Error を throw する', async () => {
    stubFetch(null, false)
    await expect(fetchStock(9999)).rejects.toThrow('Failed to fetch stock')
  })
})

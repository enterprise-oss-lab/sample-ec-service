import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchInventories, fetchInventory, adjustStock, createProduct, updateProduct, deleteProduct } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchInventories', () => {
  it('正常レスポンスで Inventory[] を返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        {
          id: 1,
          name: 'Product A',
          count: 5,
          price: 1000,
          description: '説明A',
          image_key: 'products/a.jpg',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]),
    }))

    const inventories = await fetchInventories()

    expect(inventories).toHaveLength(1)
    expect(inventories[0]).toMatchObject({
      id: 1,
      name: 'Product A',
      count: 5,
      price: 1000,
      description: '説明A',
      imageKey: 'products/a.jpg',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    })
  })

  it('res.ok === false で Error を throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(fetchInventories()).rejects.toThrow('Failed to fetch inventories')
  })
})

describe('adjustStock', () => {
  it('res.ok === true の場合は何も throw しない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await expect(adjustStock(1, 1)).resolves.toBeUndefined()
  })

  it('res.ok === false でサーバのエラーメッセージを throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'insufficient stock' }),
    }))

    await expect(adjustStock(1, -10)).rejects.toThrow('insufficient stock')
  })
})

describe('fetchInventory', () => {
  it('正常レスポンスで Inventory を返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        name: 'Product A',
        count: 5,
        price: 1000,
        description: '説明A',
        image_key: 'products/a.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }),
    }))

    const inventory = await fetchInventory(1)

    expect(inventory).toMatchObject({
      id: 1,
      name: 'Product A',
      count: 5,
      price: 1000,
      description: '説明A',
      imageKey: 'products/a.jpg',
    })
  })

  it('res.ok === false で Error を throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(fetchInventory(1)).rejects.toThrow('Failed to fetch inventory')
  })
})

describe('createProduct', () => {
  it('正常レスポンスで作成された Inventory を返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 3,
        name: 'New Product',
        count: 10,
        price: 500,
        description: '',
        image_key: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }),
    }))

    const inventory = await createProduct({
      name: 'New Product',
      price: 500,
      description: '',
      image_key: null,
      count: 10,
    })

    expect(inventory).toMatchObject({ id: 3, name: 'New Product', count: 10, price: 500 })
  })

  it('res.ok === false でサーバのエラーメッセージを throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid name' }),
    }))

    await expect(
      createProduct({ name: '', price: 500, description: '', image_key: null, count: 10 }),
    ).rejects.toThrow('invalid name')
  })
})

describe('updateProduct', () => {
  it('正常レスポンスで更新された Inventory を返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        name: 'Updated Product',
        count: 5,
        price: 1500,
        description: '更新済み',
        image_key: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      }),
    }))

    const inventory = await updateProduct(1, {
      name: 'Updated Product',
      price: 1500,
      description: '更新済み',
      image_key: null,
    })

    expect(inventory).toMatchObject({ id: 1, name: 'Updated Product', price: 1500 })
  })

  it('res.ok === false でサーバのエラーメッセージを throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'not found' }),
    }))

    await expect(
      updateProduct(999, { name: 'x', price: 1, description: '', image_key: null }),
    ).rejects.toThrow('not found')
  })
})

describe('deleteProduct', () => {
  it('res.ok === true の場合は何も throw しない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await expect(deleteProduct(1)).resolves.toBeUndefined()
  })

  it('res.ok === false でサーバのエラーメッセージを throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'not found' }),
    }))

    await expect(deleteProduct(999)).rejects.toThrow('not found')
  })
})

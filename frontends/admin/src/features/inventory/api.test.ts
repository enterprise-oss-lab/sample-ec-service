import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchInventories, adjustStock } from './api'

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

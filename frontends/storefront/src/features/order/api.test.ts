import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchOrders, createOrder } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchOrders', () => {
  it('正常レスポンスで Order[] を返す', async () => {
    const mockOrders = [
      {
        id: 'order-1',
        customer_id: 'guest',
        items: [{ inventory_id: 1, quantity: 2, unit_price_at_order: 1200 }],
        status: 'pending',
        correlation_id: 'corr-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOrders),
    }))

    const orders = await fetchOrders()

    expect(orders).toHaveLength(1)
    expect(orders[0].id).toBe('order-1')
    expect(orders[0].status).toBe('pending')
  })

  it('res.ok === false で Error を throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(fetchOrders()).rejects.toThrow('Failed to fetch orders')
  })
})

describe('createOrder', () => {
  it('POST 成功', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await expect(
      createOrder({ customer_id: 'guest', items: [{ inventory_id: 1, quantity: 1, expected_unit_price: 1200 }] }),
    ).resolves.toBeUndefined()
  })

  it('res.ok === false で Error を throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(
      createOrder({ customer_id: 'guest', items: [{ inventory_id: 1, quantity: 1, expected_unit_price: 1200 }] }),
    ).rejects.toThrow('注文に失敗しました')
  })

  it('価格変更時は再確認を促す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }))

    await expect(
      createOrder({ customer_id: 'guest', items: [{ inventory_id: 1, quantity: 1, expected_unit_price: 1200 }] }),
    ).rejects.toThrow('価格が変更されました。商品を再読み込みして確認してください')
  })
})

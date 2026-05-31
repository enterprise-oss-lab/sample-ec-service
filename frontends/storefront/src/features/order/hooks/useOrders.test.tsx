import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useOrders } from './useOrders'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useOrders', () => {
  it('初期状態で isPending が true', () => {
    const { result } = renderHookWithProviders(() => useOrders())
    expect(result.current.isPending).toBe(true)
  })

  it('成功時に orders を返す', async () => {
    const { result } = renderHookWithProviders(() => useOrders())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].id).toBe('order-1')
  })

  it('失敗時に isError が true になる', async () => {
    server.use(
      http.get(/\/orders$/, () => new HttpResponse(null, { status: 500 })),
    )
    const { result } = renderHookWithProviders(() => useOrders())
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

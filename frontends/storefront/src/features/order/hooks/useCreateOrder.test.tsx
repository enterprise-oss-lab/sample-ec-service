import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useCreateOrder } from './useCreateOrder'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const testReq = { customer_id: 'guest', items: [{ inventory_id: 1, quantity: 1 }] }

describe('useCreateOrder', () => {
  it('mutate() で createOrder が実行される', async () => {
    const { result } = renderHookWithProviders(() => useCreateOrder())
    act(() => { result.current.mutate(testReq) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('onSuccess コールバックが呼ばれる', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHookWithProviders(() => useCreateOrder({ onSuccess }))
    act(() => { result.current.mutate(testReq) })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('onError コールバックが呼ばれる', async () => {
    server.use(
      http.post(/\/orders$/, () => new HttpResponse(null, { status: 500 })),
    )
    const onError = vi.fn()
    const { result } = renderHookWithProviders(() => useCreateOrder({ onError }))
    act(() => { result.current.mutate(testReq) })
    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })
})

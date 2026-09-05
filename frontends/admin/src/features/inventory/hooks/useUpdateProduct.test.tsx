import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useUpdateProduct } from './useUpdateProduct'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const REQ = { name: 'Updated Product', price: 1500, description: '更新済み', image_key: null }

describe('useUpdateProduct', () => {
  it('mutate() で updateProduct が実行される', async () => {
    const { result } = renderHookWithProviders(() => useUpdateProduct())
    act(() => { result.current.mutate({ id: 1, req: REQ }) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('onSuccess コールバックが呼ばれる', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHookWithProviders(() => useUpdateProduct({ onSuccess }))
    act(() => { result.current.mutate({ id: 1, req: REQ }) })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('onError コールバックが呼ばれる', async () => {
    server.use(
      http.put(/\/admin\/inventories\/\d+$/, () => new HttpResponse(null, { status: 500 })),
    )
    const onError = vi.fn()
    const { result } = renderHookWithProviders(() => useUpdateProduct({ onError }))
    act(() => { result.current.mutate({ id: 1, req: REQ }) })
    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })
})

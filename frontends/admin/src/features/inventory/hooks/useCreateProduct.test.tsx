import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useCreateProduct } from './useCreateProduct'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const REQUEST = { name: 'New Product', price: 500, description: '', image_key: null, count: 10 }

describe('useCreateProduct', () => {
  it('mutate() で createProduct が実行される', async () => {
    const { result } = renderHookWithProviders(() => useCreateProduct())
    act(() => { result.current.mutate(REQUEST) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('onSuccess コールバックが呼ばれる', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHookWithProviders(() => useCreateProduct({ onSuccess }))
    act(() => { result.current.mutate(REQUEST) })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('onError コールバックが呼ばれる', async () => {
    server.use(
      http.post(/\/admin\/inventories$/, () => new HttpResponse(null, { status: 500 })),
    )
    const onError = vi.fn()
    const { result } = renderHookWithProviders(() => useCreateProduct({ onError }))
    act(() => { result.current.mutate(REQUEST) })
    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })
})

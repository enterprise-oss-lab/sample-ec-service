import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useDeleteProduct } from './useDeleteProduct'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useDeleteProduct', () => {
  it('mutate() で deleteProduct が実行される', async () => {
    const { result } = renderHookWithProviders(() => useDeleteProduct())
    act(() => { result.current.mutate(1) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('onSuccess コールバックが呼ばれる', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHookWithProviders(() => useDeleteProduct({ onSuccess }))
    act(() => { result.current.mutate(1) })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('onError コールバックが呼ばれる', async () => {
    server.use(
      http.delete(/\/admin\/inventories\/\d+$/, () => new HttpResponse(null, { status: 500 })),
    )
    const onError = vi.fn()
    const { result } = renderHookWithProviders(() => useDeleteProduct({ onError }))
    act(() => { result.current.mutate(1) })
    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })
})

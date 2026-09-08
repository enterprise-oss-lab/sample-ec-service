import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useAdjustStock } from './useAdjustStock'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useAdjustStock', () => {
  it('mutate() で adjustStock が実行される', async () => {
    const { result } = renderHookWithProviders(() => useAdjustStock())
    act(() => { result.current.mutate({ id: 1, delta: 1 }) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('onSuccess コールバックが呼ばれる', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHookWithProviders(() => useAdjustStock({ onSuccess }))
    act(() => { result.current.mutate({ id: 1, delta: 1 }) })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('onError コールバックが呼ばれる', async () => {
    server.use(
      http.post(/\/admin\/inventories\/\d+\/adjust$/, () => new HttpResponse(null, { status: 500 })),
    )
    const onError = vi.fn()
    const { result } = renderHookWithProviders(() => useAdjustStock({ onError }))
    act(() => { result.current.mutate({ id: 1, delta: -1 }) })
    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })
})

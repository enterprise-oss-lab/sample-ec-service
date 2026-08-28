import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useProducts } from './useProducts'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useProducts', () => {
  it('初期状態で isPending が true', () => {
    const { result } = renderHookWithProviders(() => useProducts())
    expect(result.current.isPending).toBe(true)
  })

  it('成功時に products を返す', async () => {
    const { result } = renderHookWithProviders(() => useProducts())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].name).toBe('Product A')
  })

  it('失敗時に isError が true になる', async () => {
    server.use(
      http.get(/\/products$/, () => new HttpResponse(null, { status: 500 })),
    )
    const { result } = renderHookWithProviders(() => useProducts())
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

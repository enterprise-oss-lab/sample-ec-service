import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useInventories } from './useInventories'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useInventories', () => {
  it('初期状態で isPending が true', () => {
    const { result } = renderHookWithProviders(() => useInventories())
    expect(result.current.isPending).toBe(true)
  })

  it('成功時に inventories を返す', async () => {
    const { result } = renderHookWithProviders(() => useInventories())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].name).toBe('Product A')
  })

  it('失敗時に isError が true になる', async () => {
    server.use(
      http.get(/\/inventories$/, () => new HttpResponse(null, { status: 500 })),
    )
    const { result } = renderHookWithProviders(() => useInventories())
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useInventory } from './useInventory'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useInventory', () => {
  it('初期状態で isPending が true', () => {
    const { result } = renderHookWithProviders(() => useInventory(1))
    expect(result.current.isPending).toBe(true)
  })

  it('成功時に inventory を返す', async () => {
    const { result } = renderHookWithProviders(() => useInventory(1))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Product A')
  })

  it('失敗時に isError が true になる', async () => {
    server.use(
      http.get(/\/inventories\/\d+$/, () => new HttpResponse(null, { status: 500 })),
    )
    const { result } = renderHookWithProviders(() => useInventory(1))
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

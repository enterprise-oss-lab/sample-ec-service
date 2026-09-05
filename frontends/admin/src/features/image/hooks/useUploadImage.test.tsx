import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderHookWithProviders } from '@/test-utils'
import { useUploadImage } from './useUploadImage'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' })

describe('useUploadImage', () => {
  it('mutate() で uploadImage が実行される', async () => {
    const { result } = renderHookWithProviders(() => useUploadImage())
    act(() => { result.current.mutate(file) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('products/mock-uuid.jpg')
  })

  it('onSuccess コールバックが呼ばれる', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHookWithProviders(() => useUploadImage({ onSuccess }))
    act(() => { result.current.mutate(file) })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('onError コールバックが呼ばれる', async () => {
    server.use(
      http.post(/\/admin\/images$/, () =>
        HttpResponse.json({ error: 'unsupported image type' }, { status: 422 }),
      ),
    )
    const onError = vi.fn()
    const { result } = renderHookWithProviders(() => useUploadImage({ onError }))
    act(() => { result.current.mutate(file) })
    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })
})

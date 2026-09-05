import { describe, it, expect, vi, afterEach } from 'vitest'
import { uploadImage } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadImage', () => {
  it('正常レスポンスで image_key を返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ image_key: 'products/abc.jpg' }),
    }))

    const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' })
    const imageKey = await uploadImage(file)

    expect(imageKey).toBe('products/abc.jpg')
  })

  it('res.ok === false でサーバのエラーメッセージを throw する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'unsupported image type' }),
    }))

    const file = new File(['dummy'], 'photo.txt', { type: 'text/plain' })
    await expect(uploadImage(file)).rejects.toThrow('unsupported image type')
  })
})

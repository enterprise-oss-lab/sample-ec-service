import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test-utils'
import { ImageUploader } from './ImageUploader'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' })

describe('ImageUploader', () => {
  it('既存の imageKey がある場合はプレビュー画像を表示する', () => {
    renderWithProviders(<ImageUploader imageKey="products/a.jpg" onChange={vi.fn()} />)
    expect(screen.getByAltText('商品画像プレビュー')).toBeInTheDocument()
  })

  it('imageKey が無い場合はプレビューを表示しない', () => {
    renderWithProviders(<ImageUploader imageKey={null} onChange={vi.fn()} />)
    expect(screen.queryByAltText('商品画像プレビュー')).not.toBeInTheDocument()
  })

  it('ファイル選択でアップロードが実行され、onChange が image_key で呼ばれる', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<ImageUploader imageKey={null} onChange={onChange} />)

    await user.upload(screen.getByLabelText('画像'), file)

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('products/mock-uuid.jpg'))
    expect(screen.getByAltText('商品画像プレビュー')).toBeInTheDocument()
  })

  it('アップロード失敗時にエラーメッセージを表示する', async () => {
    server.use(
      http.post(/\/admin\/images$/, () =>
        HttpResponse.json({ error: 'unsupported image type' }, { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<ImageUploader imageKey={null} onChange={vi.fn()} />)

    await user.upload(screen.getByLabelText('画像'), file)

    await waitFor(() => expect(screen.getByText('unsupported image type')).toBeInTheDocument())
  })
})

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test-utils'
import { ProductDetail } from './ProductDetail'

const mockNavigate = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return { ...(actual as object), useNavigate: () => mockNavigate }
})

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  mockNavigate.mockReset()
})
afterAll(() => server.close())

function renderDetail(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/products/:id" element={<ProductDetail />} />
    </Routes>,
    { initialEntries: [`/products/${id}`] },
  )
}

describe('ProductDetail', () => {
  it('カタログ属性 (名前・価格・説明) を表示する', async () => {
    renderDetail('1')
    await waitFor(() => expect(screen.getByText('Product A')).toBeInTheDocument())
    expect(screen.getByText('¥1,200')).toBeInTheDocument()
    expect(screen.getByText('Product A の説明文')).toBeInTheDocument()
  })

  it('在庫は別 API から取得して表示する', async () => {
    renderDetail('1')
    await waitFor(() => expect(screen.getByTestId('stock-label')).toHaveTextContent('在庫: 5点'))
  })

  it('存在しない ID では not found を表示する', async () => {
    renderDetail('9999')
    await waitFor(() =>
      expect(screen.getByText('商品が見つかりませんでした')).toBeInTheDocument(),
    )
  })

  it('数値でない ID では not found を表示する', () => {
    renderDetail('abc')
    expect(screen.getByText('商品が見つかりませんでした')).toBeInTheDocument()
  })

  it('カタログ取得が失敗したときは not found とは別のメッセージを出す', async () => {
    server.use(
      http.get(/\/products\/(\d+)$/, () => new HttpResponse(null, { status: 500 })),
    )
    renderDetail('1')
    await waitFor(() =>
      expect(screen.getByText('商品の取得に失敗しました')).toBeInTheDocument(),
    )
    expect(screen.queryByText('商品が見つかりませんでした')).not.toBeInTheDocument()
  })

  it('在庫 0 の商品は注文ボタンが disabled', async () => {
    renderDetail('2')
    await waitFor(() => expect(screen.getByText('Out of Stock')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '在庫なし' })).toBeDisabled()
  })

  it('カタログが取れても在庫取得に失敗したら注文させない', async () => {
    server.use(
      http.get(/\/inventories\/(\d+)$/, () => new HttpResponse(null, { status: 500 })),
    )
    renderDetail('1')
    await waitFor(() => expect(screen.getByText('Product A')).toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByTestId('stock-label')).toHaveTextContent('在庫情報を取得できませんでした'),
    )
    expect(screen.getByRole('button', { name: '在庫を確認中...' })).toBeDisabled()
  })

  it('数量を増やして注文すると /orders に遷移する', async () => {
    const user = userEvent.setup()
    renderDetail('1')
    await waitFor(() => expect(screen.getByRole('button', { name: '注文する' })).toBeEnabled())

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('1')
    await user.click(screen.getByText('＋'))
    expect(input.value).toBe('2')

    await user.click(screen.getByRole('button', { name: '注文する' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/orders'))
  })
})

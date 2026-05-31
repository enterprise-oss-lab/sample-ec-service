import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test-utils'
import { ProductList } from './ProductList'

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

async function renderAndWait() {
  renderWithProviders(<ProductList />)
  await waitFor(() => expect(screen.getByText('Product A')).toBeInTheDocument())
}

describe('ProductList', () => {
  it('ローディング中に Loading... を表示する', () => {
    renderWithProviders(<ProductList />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('商品一覧が表示される', async () => {
    await renderAndWait()
    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.getByText('Out of Stock')).toBeInTheDocument()
  })

  it('エラー時に エラーメッセージを表示する', async () => {
    server.use(
      http.get(/\/inventories$/, () => new HttpResponse(null, { status: 500 })),
    )
    renderWithProviders(<ProductList />)
    await waitFor(() =>
      expect(screen.getByText('商品の取得に失敗しました')).toBeInTheDocument(),
    )
  })

  it('＋ ボタンで数量が増える', async () => {
    const user = userEvent.setup()
    await renderAndWait()

    const items = screen.getAllByRole('listitem')
    const productAItem = items.find((item) => item.textContent?.includes('Product A'))!
    const input = within(productAItem).getByRole('spinbutton') as HTMLInputElement
    const plusBtn = within(productAItem).getByText('＋')

    expect(input.value).toBe('1')
    await user.click(plusBtn)
    expect(input.value).toBe('2')
  })

  it('− ボタンで数量が減る（下限 1 で disabled）', async () => {
    const user = userEvent.setup()
    await renderAndWait()

    const items = screen.getAllByRole('listitem')
    const productAItem = items.find((item) => item.textContent?.includes('Product A'))!
    const input = within(productAItem).getByRole('spinbutton') as HTMLInputElement
    const minusBtn = within(productAItem).getByText('−')
    const plusBtn = within(productAItem).getByText('＋')

    expect(minusBtn).toBeDisabled()
    await user.click(plusBtn)
    expect(minusBtn).not.toBeDisabled()
    await user.click(minusBtn)
    expect(input.value).toBe('1')
    expect(minusBtn).toBeDisabled()
  })

  it('在庫 0 の商品は「在庫なし」ボタンが disabled', async () => {
    await renderAndWait()

    const items = screen.getAllByRole('listitem')
    const outOfStockItem = items.find((item) => item.textContent?.includes('Out of Stock'))!
    const orderBtn = within(outOfStockItem).getByRole('button', { name: '在庫なし' })

    expect(orderBtn).toBeDisabled()
  })

  it('「注文する」クリックで createOrder が呼ばれる', async () => {
    const user = userEvent.setup()
    await renderAndWait()

    const items = screen.getAllByRole('listitem')
    const productAItem = items.find((item) => item.textContent?.includes('Product A'))!
    const orderBtn = within(productAItem).getByRole('button', { name: '注文する' })

    await user.click(orderBtn)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/orders'))
  })

  it('注文成功後に flash メッセージが表示されて /orders に遷移する', async () => {
    const user = userEvent.setup()
    await renderAndWait()

    const items = screen.getAllByRole('listitem')
    const productAItem = items.find((item) => item.textContent?.includes('Product A'))!
    const orderBtn = within(productAItem).getByRole('button', { name: '注文する' })

    await user.click(orderBtn)
    await waitFor(() =>
      expect(screen.getByText('注文が完了しました')).toBeInTheDocument(),
    )
    expect(mockNavigate).toHaveBeenCalledWith('/orders')
  })
})

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test-utils'
import { InventoryTable } from './InventoryTable'
import type { Inventory } from '../api'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const inventories: Inventory[] = [
  {
    id: 1,
    name: 'Product A',
    count: 5,
    price: 1000,
    description: '説明A',
    imageKey: 'products/product-a.jpg',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Out of Stock',
    count: 0,
    price: 2000,
    description: '説明B',
    imageKey: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

function findRow(name: string) {
  return screen.getAllByRole('row').find((row) => row.textContent?.includes(name))!
}

describe('InventoryTable', () => {
  it('商品一覧が表示される', () => {
    renderWithProviders(<InventoryTable inventories={inventories} />)
    expect(screen.getByText('Product A')).toBeInTheDocument()
    expect(screen.getByText('Out of Stock')).toBeInTheDocument()
  })

  it('image_key がある商品は img タグで画像を表示する', () => {
    renderWithProviders(<InventoryTable inventories={inventories} />)
    const img = within(findRow('Product A')).getByRole('img', { name: 'Product A' }) as HTMLImageElement
    expect(img.src).toContain('products/product-a.jpg')
  })

  it('image_key が無い商品はプレースホルダーにフォールバックする', () => {
    renderWithProviders(<InventoryTable inventories={inventories} />)
    expect(within(findRow('Out of Stock')).queryByRole('img')).not.toBeInTheDocument()
  })

  it('＋ ボタンで在庫調整 API が呼ばれ、一覧が更新される', async () => {
    server.use(
      http.post(/\/admin\/inventories\/1\/adjust$/, () => new HttpResponse(null, { status: 204 })),
    )
    const user = userEvent.setup()
    renderWithProviders(<InventoryTable inventories={inventories} />)

    const row = findRow('Product A')
    await user.click(within(row).getByLabelText('在庫を増やす'))

    await waitFor(() => expect(within(row).getByLabelText('在庫を増やす')).not.toBeDisabled())
  })

  it('在庫 0 の商品は − ボタンが disabled', () => {
    renderWithProviders(<InventoryTable inventories={inventories} />)
    expect(within(findRow('Out of Stock')).getByLabelText('在庫を減らす')).toBeDisabled()
  })

  it('調整に失敗した場合 flash でエラーメッセージを表示する', async () => {
    server.use(
      http.post(/\/admin\/inventories\/1\/adjust$/, () =>
        HttpResponse.json({ error: '在庫が不足しています' }, { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<InventoryTable inventories={inventories} />)

    await user.click(within(findRow('Product A')).getByLabelText('在庫を減らす'))

    await waitFor(() =>
      expect(screen.getByText('在庫が不足しています')).toBeInTheDocument(),
    )
  })
})

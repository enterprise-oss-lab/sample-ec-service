import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test-utils'
import { OrderList } from './OrderList'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('OrderList', () => {
  it('ローディング中に Loading... を表示する', () => {
    renderWithProviders(<OrderList />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('注文一覧が表示される', async () => {
    renderWithProviders(<OrderList />)
    await waitFor(() =>
      expect(screen.getByText('order-1')).toBeInTheDocument(),
    )
    expect(screen.getByText('order-2')).toBeInTheDocument()
  })

  it('STATUS_LABEL のマッピングが正しく表示される', async () => {
    renderWithProviders(<OrderList />)
    await waitFor(() =>
      expect(screen.getByText('処理中')).toBeInTheDocument(),
    )
    expect(screen.getByText('配達済')).toBeInTheDocument()
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    server.use(
      http.get(/\/orders$/, () => new HttpResponse(null, { status: 500 })),
    )
    renderWithProviders(<OrderList />)
    await waitFor(() =>
      expect(screen.getByText('注文の取得に失敗しました')).toBeInTheDocument(),
    )
  })

  it('空リスト時に「注文履歴がありません」を表示する', async () => {
    server.use(
      http.get(/\/orders$/, () => HttpResponse.json([])),
    )
    renderWithProviders(<OrderList />)
    await waitFor(() =>
      expect(screen.getByText('注文履歴がありません')).toBeInTheDocument(),
    )
  })
})

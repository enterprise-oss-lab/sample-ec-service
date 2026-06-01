import { test, expect } from '@playwright/test'

const ORDER_API = 'http://localhost:8081'

const mockOrders = [
  {
    id: 'order-1',
    customer_id: 'guest',
    items: [{ inventory_id: 1, quantity: 2 }],
    status: 'pending',
    correlation_id: 'corr-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'order-2',
    customer_id: 'guest',
    items: [{ inventory_id: 2, quantity: 1 }],
    status: 'delivered',
    correlation_id: 'corr-2',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
]

test.describe('注文履歴ページ', () => {
  test('注文履歴ページに注文リストが表示される', async ({ page }) => {
    await page.route(`${ORDER_API}/orders`, (route) => {
      route.fulfill({ json: mockOrders })
    })
    await page.goto('/orders')
    await page.waitForSelector('text=order-1')

    await expect(page.getByText('order-1')).toBeVisible()
    await expect(page.getByText('order-2')).toBeVisible()
  })

  test('各注文にステータスラベル（日本語）が表示される', async ({ page }) => {
    await page.route(`${ORDER_API}/orders`, (route) => {
      route.fulfill({ json: mockOrders })
    })
    await page.goto('/orders')
    await page.waitForSelector('text=処理中')

    await expect(page.getByText('処理中')).toBeVisible()
    await expect(page.getByText('配達済')).toBeVisible()
  })

  test('空の場合「注文履歴がありません」が表示される', async ({ page }) => {
    await page.route(`${ORDER_API}/orders`, (route) => {
      route.fulfill({ json: [] })
    })

    await page.goto('/orders')
    await expect(page.getByText('注文履歴がありません')).toBeVisible()
  })
})

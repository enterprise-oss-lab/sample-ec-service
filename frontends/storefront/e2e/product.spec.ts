import { test, expect } from '@playwright/test'

const INVENTORY_API = 'http://localhost:18081'

const mockInventories = [
  { id: 1, name: 'Product A', count: 5, price: 1000, description: '素材にこだわった一品です', image_key: 'products/product-a.jpg' },
  { id: 2, name: 'Out of Stock', count: 0, price: 2000, description: '定番のロングセラー商品', image_key: null },
]

test.describe('商品一覧ページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${INVENTORY_API}/inventories`, (route) => {
      route.fulfill({ json: mockInventories })
    })
    await page.route('http://localhost:8081/orders', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 201, json: { id: 'order-new' } })
      } else {
        route.fulfill({ json: [] })
      }
    })
    await page.goto('/products')
    await page.waitForSelector('text=Product A')
  })

  test('商品一覧ページに商品が表示される', async ({ page }) => {
    await expect(page.getByText('Product A')).toBeVisible()
    await expect(page.getByText('Out of Stock')).toBeVisible()
  })

  test('数量の増減ボタンが動作する', async ({ page }) => {
    const listItems = page.locator('ul > li')
    const productAItem = listItems.filter({ hasText: 'Product A' }).first()

    const input = productAItem.locator('input[type="number"]')
    const plusBtn = productAItem.getByText('＋')
    const minusBtn = productAItem.getByText('−')

    await expect(input).toHaveValue('1')
    await expect(minusBtn).toBeDisabled()

    await plusBtn.click()
    await expect(input).toHaveValue('2')
    await expect(minusBtn).toBeEnabled()

    await minusBtn.click()
    await expect(input).toHaveValue('1')
  })

  test('「注文する」クリック後にフラッシュメッセージが表示される', async ({ page }) => {
    const listItems = page.locator('ul > li')
    const productAItem = listItems.filter({ hasText: 'Product A' }).first()

    await productAItem.getByRole('button', { name: '注文する' }).click()

    await expect(page.getByText('注文が完了しました')).toBeVisible()
  })

  test('注文後に /orders ページへ遷移する', async ({ page }) => {
    const listItems = page.locator('ul > li')
    const productAItem = listItems.filter({ hasText: 'Product A' }).first()

    await productAItem.getByRole('button', { name: '注文する' }).click()

    await expect(page).toHaveURL('/orders')
  })

  test('在庫なし商品のボタンが disabled になっている', async ({ page }) => {
    const listItems = page.locator('ul > li')
    const outOfStockItem = listItems.filter({ hasText: 'Out of Stock' }).first()

    await expect(outOfStockItem.getByRole('button', { name: '在庫なし' })).toBeDisabled()
  })
})

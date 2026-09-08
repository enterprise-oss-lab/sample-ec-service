import { test, expect } from '@playwright/test'

const INVENTORY_API = 'http://localhost:18081'

const mockInventories = [
  { id: 1, name: 'Product A', count: 5, price: 1000, description: '素材にこだわった一品です', image_key: 'products/product-a.jpg' },
  { id: 2, name: 'Out of Stock', count: 0, price: 2000, description: '定番のロングセラー商品', image_key: null },
]

// カタログは在庫とは別エンドポイント (更新頻度が違うため分離されている)
const mockProducts = [
  {
    id: 1,
    name: 'Product A',
    description: 'Product A の説明文',
    price: 1200,
    image_key: null,
  },
  {
    id: 2,
    name: 'Out of Stock',
    description: '在庫切れ商品の説明文',
    price: 3400,
    image_key: null,
  },
]

test.describe('商品一覧ページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${INVENTORY_API}/inventories`, (route) => {
      route.fulfill({ json: mockInventories })
    })
    await page.route(`${INVENTORY_API}/inventories/*`, (route) => {
      const id = Number(new URL(route.request().url()).pathname.split('/').pop())
      const stock = mockInventories.find((i) => i.id === id)
      route.fulfill(stock ? { json: stock } : { status: 404, json: { error: 'inventory not found' } })
    })
    await page.route(`${INVENTORY_API}/products`, (route) => {
      route.fulfill({ json: mockProducts })
    })
    await page.route(`${INVENTORY_API}/products/*`, (route) => {
      const id = Number(new URL(route.request().url()).pathname.split('/').pop())
      const product = mockProducts.find((p) => p.id === id)
      route.fulfill(product ? { json: product } : { status: 404, json: { error: 'product not found' } })
    })
    await page.route('http://localhost:8081/orders', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 201, json: { id: 'order-new' } })
      } else {
        route.fulfill({ json: [] })
      }
    })
    await page.goto('/products')
    await page.getByRole('link', { name: 'Product A' }).waitFor()
  })

  test('商品一覧ページに商品が表示される', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Product A' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Out of Stock' })).toBeVisible()
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

test.describe('商品詳細ページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${INVENTORY_API}/products/*`, (route) => {
      const id = Number(new URL(route.request().url()).pathname.split('/').pop())
      const product = mockProducts.find((p) => p.id === id)
      route.fulfill(product ? { json: product } : { status: 404, json: { error: 'product not found' } })
    })
    await page.route(`${INVENTORY_API}/inventories/*`, (route) => {
      const id = Number(new URL(route.request().url()).pathname.split('/').pop())
      const stock = mockInventories.find((i) => i.id === id)
      route.fulfill(stock ? { json: stock } : { status: 404, json: { error: 'inventory not found' } })
    })
    await page.route('http://localhost:8081/orders', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 201, json: { id: 'order-new' } })
      } else {
        route.fulfill({ json: [] })
      }
    })
  })

  test('カタログ属性と在庫が表示される', async ({ page }) => {
    await page.goto('/products/1')
    // getByText('Product A') は説明文にも部分一致して strict mode 違反になる
    await expect(page.getByRole('heading', { name: 'Product A' })).toBeVisible()
    await expect(page.getByText('¥1,200')).toBeVisible()
    await expect(page.getByText('Product A の説明文')).toBeVisible()
    await expect(page.getByTestId('stock-label')).toHaveText('在庫: 5点')
  })

  test('存在しない商品は not found を表示する', async ({ page }) => {
    await page.goto('/products/9999')
    await expect(page.getByText('商品が見つかりませんでした')).toBeVisible()
  })

  test('一覧から商品詳細へ遷移できる', async ({ page }) => {
    await page.route(`${INVENTORY_API}/inventories`, (route) => {
      route.fulfill({ json: mockInventories })
    })
    await page.route(`${INVENTORY_API}/products`, (route) => {
      route.fulfill({ json: mockProducts })
    })
    await page.goto('/products')
    await page.getByRole('link', { name: 'Product A' }).click()
    await expect(page).toHaveURL('/products/1')
    await expect(page.getByText('Product A の説明文')).toBeVisible()
  })
})

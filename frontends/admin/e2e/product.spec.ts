import { test, expect } from '@playwright/test'

const INVENTORY_API = 'http://localhost:18081'

let inventories = [
  { id: 1, name: 'Product A', count: 5, price: 1000, description: '説明A', image_key: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
]

test.describe('商品作成', () => {
  test.beforeEach(async ({ page }) => {
    inventories = [
      { id: 1, name: 'Product A', count: 5, price: 1000, description: '説明A', image_key: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    ]

    await page.route(`${INVENTORY_API}/inventories`, (route) => {
      route.fulfill({
        json: inventories.map(({ id, count }) => ({ id, count })),
      })
    })
    await page.route(`${INVENTORY_API}/products`, (route) => {
      route.fulfill({
        json: inventories.map(({ id, name, price, description, image_key, created_at, updated_at }) => ({
          id,
          name,
          price,
          description,
          image_key,
          created_at,
          updated_at,
        })),
      })
    })
    await page.route(`${INVENTORY_API}/admin/inventories`, (route) => {
      if (route.request().method() === 'POST') {
        const req = route.request().postDataJSON()
        const created = {
          id: 2,
          name: req.name,
          price: req.price,
          description: req.description,
          image_key: req.image_key,
          count: req.count,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        }
        inventories = [...inventories, created]
        route.fulfill({ status: 201, json: created })
      } else {
        route.continue()
      }
    })
  })

  test('商品を作成すると一覧に出る', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('table')
    await expect(page.getByText('Product A')).toBeVisible()

    await page.getByRole('link', { name: '新規作成' }).click()
    await expect(page).toHaveURL('/products/new')

    await page.getByLabel('商品名').fill('新しい商品')
    await page.getByLabel('価格').fill('3000')
    await page.getByLabel('説明').fill('新商品の説明です')
    await page.getByLabel('初期在庫数').fill('20')
    await page.getByRole('button', { name: '保存する' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText('商品を作成しました')).toBeVisible()
    await expect(page.getByText('新しい商品')).toBeVisible()
  })
})

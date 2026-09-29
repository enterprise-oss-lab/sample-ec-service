import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import playwright from '../frontends/storefront/node_modules/@playwright/test/index.js'

const root = resolve(import.meta.dirname, '..')
const { chromium } = playwright
const storefront = 'http://localhost:3001'
const admin = 'http://localhost:3002'
const orderApi = 'http://localhost:8081'
const inventoryApi = 'http://localhost:18081'

function environment() {
  const values = {}
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index > 0) values[line.slice(0, index)] = line.slice(index + 1)
  }
  return values
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function waitFor(url) {
  const deadline = Date.now() + 120_000
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = new Error(`${url} returned ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`)
}

async function login(browser, baseUrl, username, password, storageKey) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(baseUrl)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await page.locator('input[name=loginName]').fill(username)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('input[name=password]').fill(password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL(new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), { timeout: 20_000 })
  await page.waitForFunction((key) => sessionStorage.getItem(key) !== null, storageKey)
  const token = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).accessToken, storageKey)
  assert(typeof token === 'string' && token.length > 0, `No access token after login as ${username}`)
  return { context, page, token }
}

async function request(url, options = {}) {
  const response = await fetch(url, options)
  return { response, body: response.status === 204 ? undefined : await response.json().catch(() => undefined) }
}

const env = environment()
for (const key of [
  'ZITADEL_CUSTOMER_1_USERNAME', 'ZITADEL_CUSTOMER_1_PASSWORD',
  'ZITADEL_CUSTOMER_2_USERNAME', 'ZITADEL_CUSTOMER_2_PASSWORD',
  'ZITADEL_ADMIN_USERNAME', 'ZITADEL_ADMIN_PASSWORD',
]) assert(env[key], `${key} is required in .env`)

if (process.env.AUTH_E2E_SKIP_COMPOSE !== '1') {
  execFileSync('docker', ['compose', 'up', '--build', '-d'], { cwd: root, stdio: 'inherit' })
}
await Promise.all([waitFor(`${storefront}/`), waitFor(`${admin}/`), waitFor(`${orderApi}/docs`), waitFor(`${inventoryApi}/products`)])

const browser = await chromium.launch({ headless: true })
try {
  const customerOne = await login(browser, `${storefront}/account`, env.ZITADEL_CUSTOMER_1_USERNAME, env.ZITADEL_CUSTOMER_1_PASSWORD, 'sample-ec.storefront.session')
  const customerTwo = await login(browser, `${storefront}/account`, env.ZITADEL_CUSTOMER_2_USERNAME, env.ZITADEL_CUSTOMER_2_PASSWORD, 'sample-ec.storefront.session')
  const administrator = await login(browser, admin, env.ZITADEL_ADMIN_USERNAME, env.ZITADEL_ADMIN_PASSWORD, 'sample-ec.admin.session')

  const customerHeaders = { Authorization: `Bearer ${customerOne.token}`, 'Content-Type': 'application/json' }
  const created = await request(`${orderApi}/orders`, { method: 'POST', headers: customerHeaders, body: JSON.stringify({ items: [{ inventory_id: 1, quantity: 1 }] }) })
  assert(created.response.status === 201, `Customer order creation failed: ${created.response.status}`)
  assert(created.body?.id, 'Created order has no ID')

  const ownOrders = await request(`${orderApi}/orders`, { headers: { Authorization: `Bearer ${customerOne.token}` } })
  assert(ownOrders.response.ok && ownOrders.body.some((order) => order.id === created.body.id), 'Customer cannot read their own order')

  const otherOrder = await request(`${orderApi}/orders/${created.body.id}`, { headers: { Authorization: `Bearer ${customerTwo.token}` } })
  assert(otherOrder.response.status === 404, `Another customer can read an order: ${otherOrder.response.status}`)

  const customerAdmin = await request(`${inventoryApi}/admin/inventories/1/adjust`, { method: 'POST', headers: { Authorization: `Bearer ${customerOne.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ delta: 1 }) })
  assert(customerAdmin.response.status === 403, `Customer can use admin API: ${customerAdmin.response.status}`)

  const anonymousOrder = await request(`${orderApi}/orders`)
  const anonymousAdmin = await request(`${inventoryApi}/admin/inventories/1/adjust`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta: 1 }) })
  assert(anonymousOrder.response.status === 401 && anonymousAdmin.response.status === 401, 'Anonymous requests must return 401')

  const adminHeaders = { Authorization: `Bearer ${administrator.token}`, 'Content-Type': 'application/json' }
  const product = await request(`${inventoryApi}/admin/inventories`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ name: `E2E product ${Date.now()}`, price: 100, description: 'created by auth e2e', image_key: null, count: 1 }) })
  assert(product.response.status === 201, `Admin product creation failed: ${product.response.status}`)
  const adjusted = await request(`${inventoryApi}/admin/inventories/${product.body.id}/adjust`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ delta: 1 }) })
  assert(adjusted.response.status === 204, `Admin inventory adjustment failed: ${adjusted.response.status}`)

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLAtwAAAABJRU5ErkJggg==', 'base64')
  const imageForm = new FormData()
  imageForm.append('image', new Blob([png], { type: 'image/png' }), 'e2e.png')
  const image = await request(`${inventoryApi}/admin/images`, { method: 'POST', headers: { Authorization: `Bearer ${administrator.token}` }, body: imageForm })
  assert(image.response.status === 201 && image.body?.image_key, `Admin image upload failed: ${image.response.status}`)

  await customerOne.page.goto(admin)
  await customerOne.page.getByRole('button', { name: 'ログイン' }).click()
  await customerOne.page.locator('input[name=loginName]').fill(env.ZITADEL_CUSTOMER_1_USERNAME)
  await customerOne.page.getByRole('button', { name: 'Continue' }).click()
  await customerOne.page.locator('input[name=password]').fill(env.ZITADEL_CUSTOMER_1_PASSWORD)
  await customerOne.page.getByRole('button', { name: 'Continue' }).click()
  await customerOne.page.getByText('管理者権限が必要です。').waitFor({ timeout: 20_000 })

  console.log('Authentication and authorization E2E passed')
} finally {
  await browser.close()
}

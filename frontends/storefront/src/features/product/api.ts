// カタログ (products) と在庫 (inventories) は別リソースとして扱う。
// 更新頻度が違うためで、カタログは日〜月単位、在庫は毎秒変わる。
// 混ぜて1本の API にすると、可変な在庫数のせいでカタログ側もキャッシュできなくなる。
// この境界がそのままキャッシュの境界になる (hooks の staleTime を参照)。

/** カタログは日〜月単位でしか変わらないので長く寝かせる */
export const CATALOG_STALE_TIME = 60 * 60 * 1000
/** 在庫は毎秒変わるので寝かせない */
export const STOCK_STALE_TIME = 0

type ProductResponse = {
  id: number
  name: string
  description: string
  price: number
  image_url: string
}

/** カタログ属性。在庫数は持たない (Stock 側の関心)。 */
export type Product = {
  id: number
  name: string
  description: string
  price: number
  imageUrl: string
}

/** 在庫。GET /inventories のレスポンスそのまま。商品名は持たない (Product 側の関心)。 */
export type Stock = {
  id: number
  count: number
}

const INVENTORY_API_BASE_URL = import.meta.env.VITE_INVENTORY_API_BASE_URL ?? ''

function toProduct(res: ProductResponse): Product {
  return {
    id: res.id,
    name: res.name,
    description: res.description,
    price: res.price,
    imageUrl: res.image_url,
  }
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/products`)
  if (!res.ok) throw new Error('Failed to fetch products')
  const items: ProductResponse[] = await res.json()
  return items.map(toProduct)
}

/**
 * 存在しない商品は null を返す (throw しない)。
 * 404 は「その商品は無い」という確定した答えでエラーではないため、
 * react-query の既定リトライ (3回) に乗せてしまうと not found の表示が数秒遅れる。
 * 通信障害などの本当のエラーは throw してリトライさせる。
 */
export async function fetchProduct(id: number): Promise<Product | null> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/products/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch product')
  return toProduct(await res.json())
}

export async function fetchStocks(): Promise<Stock[]> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/inventories`)
  if (!res.ok) throw new Error('Failed to fetch stocks')
  return res.json()
}

export async function fetchStock(id: number): Promise<Stock> {
  const res = await fetch(`${INVENTORY_API_BASE_URL}/inventories/${id}`)
  if (!res.ok) throw new Error('Failed to fetch stock')
  return res.json()
}

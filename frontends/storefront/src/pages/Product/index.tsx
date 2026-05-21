import { ProductList } from '@/features/product/components/ProductList'

export const ProductPage = () => {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl mb-6">商品一覧</h1>
      <ProductList />
    </main>
  )
}

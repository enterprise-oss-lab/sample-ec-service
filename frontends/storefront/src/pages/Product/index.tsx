import { ProductList } from '@/features/product/components/ProductList'
import { PageHeader } from '@/shared/ui/PageHeader'

export const ProductPage = () => (
  <main className="mx-auto max-w-5xl px-6 py-10">
    <PageHeader label="Products" title="商品一覧" />
    <ProductList />
  </main>
)

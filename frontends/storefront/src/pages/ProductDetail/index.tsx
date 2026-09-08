import { ProductDetail } from '@/features/product/components/ProductDetail'
import { PageHeader } from '@/shared/ui/PageHeader'

export const ProductDetailPage = () => (
  <main className="mx-auto max-w-5xl px-6 py-10">
    <PageHeader label="Product" title="商品詳細" />
    <ProductDetail />
  </main>
)

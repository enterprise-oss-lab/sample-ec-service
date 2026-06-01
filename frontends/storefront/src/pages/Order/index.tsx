import { OrderList } from '@/features/order/components/OrderList'
import { PageHeader } from '@/shared/ui/PageHeader'

export const OrderPage = () => (
  <main className="mx-auto max-w-5xl px-6 py-10">
    <PageHeader label="Orders" title="注文履歴" />
    <OrderList />
  </main>
)

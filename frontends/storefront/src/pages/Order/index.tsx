
import { OrderList } from '@/features/order/components/OrderList'

export const OrderPage = () => {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl mb-6">注文履歴</h1>
      <OrderList />
    </main>
  )
}

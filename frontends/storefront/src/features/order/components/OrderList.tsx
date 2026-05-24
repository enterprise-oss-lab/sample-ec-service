import { useOrders } from '../hooks/useOrders'

const STATUS_LABEL: Record<string, string> = {
  pending: '処理中',
  confirmed: '確定',
  shipped: '発送済',
  delivered: '配達済',
  cancelled: 'キャンセル',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-gold',
  confirmed: 'text-green-400',
  shipped: 'text-blue-400',
  delivered: 'text-soft',
  cancelled: 'text-red-400',
}

export const OrderList = () => {
  const { data, isPending, isError } = useOrders()

  if (isPending) return <p className="text-dim">Loading...</p>
  if (isError) return <p className="text-red-400">注文の取得に失敗しました</p>
  if (data.length === 0) return <p className="text-dim">注文履歴がありません</p>

  return (
    <ul className="flex flex-col gap-4">
      {data.map((order) => {
        const statusLabel = STATUS_LABEL[order.status] ?? order.status
        const statusColor = STATUS_COLOR[order.status] ?? 'text-soft'
        const date = new Date(order.created_at).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
        return (
          <li key={order.id} className="bg-panel hover:bg-panel-hover rounded-lg p-5 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-dim truncate max-w-xs">{order.id}</p>
                <p className="text-pale text-sm mt-1">顧客: {order.customer_id}</p>
              </div>
              <span className={`text-sm font-medium shrink-0 ${statusColor}`}>{statusLabel}</span>
            </div>
            <ul className="mt-3 flex flex-col gap-1">
              {order.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-dim">
                  <span>商品 ID: <span className="font-mono text-soft">{item.inventory_id}</span></span>
                  <span>×{item.quantity}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-dim">{date}</p>
          </li>
        )
      })}
    </ul>
  )
}

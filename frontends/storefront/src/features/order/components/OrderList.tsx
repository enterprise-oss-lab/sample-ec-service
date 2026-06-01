import { useOrders } from '../hooks/useOrders'

const STATUS_LABEL: Record<string, string> = {
  pending:   '処理中',
  confirmed: '確定',
  shipped:   '発送済',
  delivered: '配達済',
  cancelled: 'キャンセル',
}

type StatusKey = keyof typeof STATUS_LABEL

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending:   'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-sage-light text-sage border-sage/30',
    shipped:   'bg-blue-50 text-blue-600 border-blue-200',
    delivered: 'bg-panel text-dim border-border',
    cancelled: 'bg-red-50 text-red-500 border-red-200',
  }
  const cls = styles[status] ?? 'bg-panel text-dim border-border'
  const label = STATUS_LABEL[status as StatusKey] ?? status

  return (
    <span className={`inline-block text-[0.68rem] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-sm border ${cls}`}>
      {label}
    </span>
  )
}

export const OrderList = () => {
  const { data, isPending, isError } = useOrders()

  if (isPending) return (
    <div className="flex flex-col gap-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-panel p-5 animate-pulse space-y-3">
          <div className="flex justify-between">
            <div className="h-3 bg-border rounded w-48" />
            <div className="h-5 bg-border rounded w-16" />
          </div>
          <div className="h-3 bg-border rounded w-32" />
          <div className="h-3 bg-border rounded w-24" />
        </div>
      ))}
    </div>
  )

  if (isError) return (
    <div className="py-16 text-center">
      <p className="text-dim text-sm">注文の取得に失敗しました</p>
    </div>
  )

  if (data.length === 0) return (
    <div className="py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-sage-light/50 flex items-center justify-center mx-auto mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b8c72" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>
      <p className="text-pale text-[0.9rem] font-medium mb-1">注文履歴がありません</p>
      <p className="text-dim text-[0.8rem]">ご注文いただくと、こちらに履歴が表示されます。</p>
    </div>
  )

  return (
    <ul className="flex flex-col gap-3">
      {data.map((order, i) => {
        const date = new Date(order.created_at).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
        return (
          <li
            key={order.id}
            className="animate-fade-in-up rounded-lg border border-border bg-panel hover:bg-panel-hover transition-colors duration-150 p-5"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-mono text-dim truncate">{order.id}</p>
                <p className="text-pale text-[0.875rem] font-medium mt-0.5">{order.customer_id}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            <div className="border-t border-border pt-3 space-y-1.5">
              {order.items.map((item, j) => (
                <div key={j} className="flex items-center justify-between text-[0.8rem]">
                  <span className="text-dim">
                    商品 <span className="font-mono text-soft">#{item.inventory_id}</span>
                  </span>
                  <span className="text-dim">× {item.quantity}</span>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[0.72rem] text-dim/70">{date}</p>
          </li>
        )
      })}
    </ul>
  )
}

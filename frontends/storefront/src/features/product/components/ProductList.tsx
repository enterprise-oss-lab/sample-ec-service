import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useProducts } from '../hooks/useProducts'
import { useCreateOrder } from '../../order/hooks/useCreateOrder'

export const ProductList = () => {
  const navigate = useNavigate()
  const { data, isPending, isError } = useProducts()
  const { mutate: order, isPending: isOrdering, variables } = useCreateOrder({
    onSuccess: () => navigate('/orders'),
  })
  const [quantities, setQuantities] = useState<Record<number, number>>({})

  if (isPending) return <p className="text-dim">Loading...</p>
  if (isError) return <p className="text-red-400">商品の取得に失敗しました</p>

  const getQty = (id: number) => quantities[id] ?? 1
  const setQty = (id: number, value: number) =>
    setQuantities((prev) => ({ ...prev, [id]: value }))

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((product) => {
        const isThisOrdering = isOrdering && variables?.items[0]?.inventory_id === product.id
        const qty = getQty(product.id)
        return (
          <li key={product.id} className="bg-panel hover:bg-panel-hover rounded-lg p-4 transition-colors">
            <p className="text-gold font-display text-lg">{product.name}</p>
            <p className="text-gold font-mono">¥{product.price.toLocaleString()}</p>
            <p className="text-dim text-sm">在庫: {product.count}</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                className="h-7 w-7 rounded border border-gold/40 text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={qty <= 1 || product.count === 0}
                onClick={() => setQty(product.id, qty - 1)}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={product.count}
                value={qty}
                onChange={(e) => {
                  const v = Math.min(Math.max(1, Number(e.target.value)), product.count)
                  setQty(product.id, isNaN(v) ? 1 : v)
                }}
                className="w-12 rounded border border-gold/40 bg-transparent text-center font-mono text-sm text-gold focus:outline-none focus:ring-1 focus:ring-gold/60"
              />
              <button
                className="h-7 w-7 rounded border border-gold/40 text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={qty >= product.count || product.count === 0}
                onClick={() => setQty(product.id, qty + 1)}
              >
                ＋
              </button>
            </div>
            <button
              className="mt-2 w-full rounded border border-gold/40 py-1.5 text-sm text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isThisOrdering || product.count === 0}
              onClick={() =>
                order({
                  customer_id: 'guest',
                  items: [{ inventory_id: product.id, quantity: qty }],
                })
              }
            >
              {isThisOrdering ? '注文中...' : product.count === 0 ? '在庫なし' : '注文する'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

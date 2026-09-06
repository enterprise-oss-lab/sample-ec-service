import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useProducts } from '../hooks/useProducts'
import { useCreateOrder } from '../../order/hooks/useCreateOrder'
import { useFlash } from '@/shared/Flash'
import type { Product } from '../api'

const ProductPlaceholder = (_: { id: number }) => (
  <div className="w-full aspect-square bg-sage-light/30 flex items-center justify-center">
    <svg viewBox="0 0 80 80" className="w-14 h-14 opacity-25">
      <rect x="20" y="20" width="40" height="40" rx="4" fill="none" stroke="#6b8c72" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="5" fill="#6b8c72" opacity="0.4" />
      <path d="M20 52 L32 40 L42 50 L52 38 L60 48 L60 60 L20 60 Z" fill="#6b8c72" opacity="0.2" />
    </svg>
  </div>
)

const ProductImage = ({ product }: { product: Product }) => {
  const [failed, setFailed] = useState(false)

  if (!product.imageUrl || failed) return <ProductPlaceholder id={product.id} />

  return (
    <img
      src={product.imageUrl}
      alt={product.name}
      className="w-full aspect-square object-cover"
      onError={() => setFailed(true)}
    />
  )
}

export const ProductList = () => {
  const navigate = useNavigate()
  const { flash } = useFlash()
  const { data, isPending, isError } = useProducts()
  const { mutate: order, isPending: isOrdering, variables } = useCreateOrder({
    onSuccess: () => {
      flash('注文が完了しました')
      navigate('/orders')
    },
  })
  const [quantities, setQuantities] = useState<Record<number, number>>({})

  if (isPending) return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-lg overflow-hidden bg-panel animate-pulse">
          <div className="w-full aspect-square bg-sage-light/20" />
          <div className="p-4 space-y-2">
            <div className="h-3 bg-border rounded w-1/3" />
            <div className="h-4 bg-border rounded w-2/3" />
            <div className="h-3 bg-border rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )

  if (isError) return (
    <div className="py-16 text-center">
      <p className="text-dim text-sm">商品の取得に失敗しました</p>
    </div>
  )

  const getQty = (id: number) => quantities[id] ?? 1
  const setQty = (id: number, value: number) =>
    setQuantities((prev) => ({ ...prev, [id]: value }))

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((product, i) => {
        const isThisOrdering = isOrdering && variables?.items[0]?.inventory_id === product.id
        const qty = getQty(product.id)
        const outOfStock = product.count === 0
        return (
          <li
            key={product.id}
            className="animate-fade-in-up bg-panel hover:bg-panel-hover rounded-lg overflow-hidden transition-colors duration-150 flex flex-col border border-transparent hover:border-sage/20"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <ProductImage product={product} />

            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-semibold text-pale text-[0.95rem] leading-snug mb-0.5">
                {product.name}
              </h3>
              <p className="text-sage font-semibold text-[0.95rem] mb-1">
                ¥{product.price.toLocaleString()}
              </p>
              {product.description && (
                <p className="text-[0.75rem] text-dim mb-1 line-clamp-2">{product.description}</p>
              )}
              <p className={`text-[0.75rem] mb-4 ${outOfStock ? 'text-red-400' : 'text-dim'}`}>
                {outOfStock ? '在庫なし' : `在庫: ${product.count}点`}
              </p>

              <div className="mt-auto space-y-2">
                {!outOfStock && (
                  <div className="flex items-center gap-2">
                    <button
                      className="h-7 w-7 rounded border border-border text-dim transition-colors duration-150 hover:border-sage hover:text-sage disabled:cursor-not-allowed disabled:opacity-30 bg-transparent"
                      disabled={qty <= 1}
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
                      className="w-12 rounded border border-border bg-transparent text-center text-sm text-pale focus:outline-none focus:ring-1 focus:ring-sage/40 focus:border-sage/60 transition-colors duration-150"
                    />
                    <button
                      className="h-7 w-7 rounded border border-border text-dim transition-colors duration-150 hover:border-sage hover:text-sage disabled:cursor-not-allowed disabled:opacity-30 bg-transparent"
                      disabled={qty >= product.count}
                      onClick={() => setQty(product.id, qty + 1)}
                    >
                      ＋
                    </button>
                  </div>
                )}
                <button
                  className={`w-full py-2 text-[0.8rem] rounded border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 bg-transparent
                    ${outOfStock || isThisOrdering
                      ? 'border-border text-dim'
                      : 'border-sage text-sage hover:bg-sage-light/40'
                    }`}
                  disabled={isThisOrdering || outOfStock}
                  onClick={() =>
                    order({
                      customer_id: 'guest',
                      items: [{ inventory_id: product.id, quantity: qty }],
                    })
                  }
                >
                  {isThisOrdering ? '注文中...' : outOfStock ? '在庫なし' : '注文する'}
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

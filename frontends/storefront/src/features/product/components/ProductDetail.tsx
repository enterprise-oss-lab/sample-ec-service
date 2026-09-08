import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useProduct } from '../hooks/useProduct'
import { useStock } from '../hooks/useStock'
import { useCreateOrder } from '../../order/hooks/useCreateOrder'
import { useFlash } from '@/shared/Flash'

const ImageFallback = () => (
  <div className="w-full aspect-square bg-sage-light/30 flex items-center justify-center">
    <svg viewBox="0 0 80 80" className="w-20 h-20 opacity-25">
      <rect x="20" y="20" width="40" height="40" rx="4" fill="none" stroke="#6b8c72" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="5" fill="#6b8c72" opacity="0.4" />
      <path d="M20 52 L32 40 L42 50 L52 38 L60 48 L60 60 L20 60 Z" fill="#6b8c72" opacity="0.2" />
    </svg>
  </div>
)

const BackLink = () => (
  <Link to="/products" className="text-[0.8rem] text-dim hover:text-sage transition-colors duration-150">
    ← 商品一覧に戻る
  </Link>
)

const Notice = ({ message }: { message: string }) => (
  <div className="py-16 text-center space-y-4">
    <p className="text-dim text-sm">{message}</p>
    <BackLink />
  </div>
)

export const ProductDetail = () => {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { flash } = useFlash()
  const [imageFailed, setImageFailed] = useState(false)
  const [qty, setQty] = useState(1)

  // カタログと在庫は別クエリ。staleTime が違う (api.ts のコメント参照) ため、
  // 1本にまとめてしまうとカタログを長く寝かせられなくなる。
  const product = useProduct(id)
  const stock = useStock(id)

  const { mutate: order, isPending: isOrdering } = useCreateOrder({
    onSuccess: () => {
      flash('注文が完了しました')
      navigate('/orders')
    },
  })

  if (!Number.isFinite(id)) {
    return <Notice message="商品が見つかりませんでした" />
  }

  if (product.isError) {
    // 通信障害など。「存在しない」とは別のメッセージにする。
    return <Notice message="商品の取得に失敗しました" />
  }

  if (product.isPending) {
    return (
      <div className="grid gap-8 md:grid-cols-2 animate-pulse">
        <div className="w-full aspect-square bg-sage-light/20 rounded-lg" />
        <div className="space-y-3 pt-2">
          <div className="h-3 w-1/4 bg-border rounded" />
          <div className="h-6 w-2/3 bg-border rounded" />
          <div className="h-4 w-1/3 bg-border rounded" />
          <div className="h-16 w-full bg-border rounded" />
        </div>
      </div>
    )
  }

  // fetchProduct は 404 で null を返す (api.ts のコメント参照)
  const detail = product.data
  if (detail == null) {
    return <Notice message="商品が見つかりませんでした" />
  }

  const count = stock.data?.count
  const outOfStock = count === 0
  // 在庫だけ取得に失敗した場合はカタログは出しつつ注文を止める (在庫不明で売らない)。
  const stockUnknown = stock.isPending || stock.isError || count === undefined
  const max = count ?? 1

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="grid gap-8 md:grid-cols-2">
        <div className="bg-panel rounded-lg overflow-hidden">
          {imageFailed || !detail.imageUrl ? (
            <ImageFallback />
          ) : (
            <img
              src={detail.imageUrl}
              alt={detail.name}
              className="w-full aspect-square object-cover"
              onError={() => setImageFailed(true)}
            />
          )}
        </div>

        <div className="flex flex-col">
          <h2 className="text-[1.4rem] font-semibold text-pale leading-snug mb-2">
            {detail.name}
          </h2>
          <p className="text-sage font-semibold text-[1.15rem] mb-4">
            ¥{detail.price.toLocaleString()}
          </p>
          <p className="text-soft text-[0.85rem] leading-relaxed mb-5">
            {detail.description}
          </p>

          <p
            className={`text-[0.75rem] mb-6 ${outOfStock ? 'text-red-400' : 'text-dim'}`}
            data-testid="stock-label"
          >
            {stock.isPending
              ? '在庫を確認中...'
              : stock.isError
                ? '在庫情報を取得できませんでした'
                : outOfStock
                  ? '在庫なし'
                  : `在庫: ${count}点`}
          </p>

          <div className="mt-auto space-y-3">
            {!outOfStock && !stockUnknown && (
              <div className="flex items-center gap-2">
                <button
                  className="h-8 w-8 rounded border border-border text-dim transition-colors duration-150 hover:border-sage hover:text-sage disabled:cursor-not-allowed disabled:opacity-30 bg-transparent"
                  disabled={qty <= 1}
                  onClick={() => setQty(qty - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={max}
                  value={qty}
                  onChange={(e) => {
                    const v = Math.min(Math.max(1, Number(e.target.value)), max)
                    setQty(isNaN(v) ? 1 : v)
                  }}
                  className="w-14 rounded border border-border bg-transparent text-center text-sm text-pale focus:outline-none focus:ring-1 focus:ring-sage/40 focus:border-sage/60 transition-colors duration-150"
                />
                <button
                  className="h-8 w-8 rounded border border-border text-dim transition-colors duration-150 hover:border-sage hover:text-sage disabled:cursor-not-allowed disabled:opacity-30 bg-transparent"
                  disabled={qty >= max}
                  onClick={() => setQty(qty + 1)}
                >
                  ＋
                </button>
              </div>
            )}
            <button
              className={`w-full py-2.5 text-[0.85rem] rounded border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 bg-transparent
                ${outOfStock || stockUnknown || isOrdering
                  ? 'border-border text-dim'
                  : 'border-sage text-sage hover:bg-sage-light/40'
                }`}
              disabled={isOrdering || outOfStock || stockUnknown}
              onClick={() =>
                order({
                  customer_id: 'guest',
                  items: [{ inventory_id: detail.id, quantity: qty }],
                })
              }
            >
              {isOrdering
                ? '注文中...'
                : outOfStock
                  ? '在庫なし'
                  : stockUnknown
                    ? '在庫を確認中...'
                    : '注文する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

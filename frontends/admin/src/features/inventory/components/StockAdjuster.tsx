import { useFlash } from '@/shared/Flash'
import { useAdjustStock } from '../hooks/useAdjustStock'
import type { Inventory } from '../api'

export const StockAdjuster = ({ inventory }: { inventory: Inventory }) => {
  const { flash } = useFlash()
  const { mutate, isPending } = useAdjustStock({
    onError: (err) => flash(err.message, 'error'),
  })

  const adjust = (delta: number) => mutate({ id: inventory.id, delta })

  return (
    <div className="flex items-center gap-2">
      <button
        className="h-7 w-7 rounded border border-border text-dim transition-colors duration-150 hover:border-sage hover:text-sage disabled:cursor-not-allowed disabled:opacity-30 bg-transparent"
        disabled={isPending || inventory.count <= 0}
        onClick={() => adjust(-1)}
        aria-label="在庫を減らす"
      >
        −
      </button>
      <span className="w-8 text-center tabular-nums">{inventory.count}</span>
      <button
        className="h-7 w-7 rounded border border-border text-dim transition-colors duration-150 hover:border-sage hover:text-sage disabled:cursor-not-allowed disabled:opacity-30 bg-transparent"
        disabled={isPending}
        onClick={() => adjust(1)}
        aria-label="在庫を増やす"
      >
        ＋
      </button>
    </div>
  )
}

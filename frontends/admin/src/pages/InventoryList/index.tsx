import { Link } from 'react-router'
import { useInventories } from '@/features/inventory/hooks/useInventories'
import { InventoryTable } from '@/features/inventory/components/InventoryTable'
import { Button } from '@/shared/ui/Button'

export const InventoryListPage = () => {
  const { data, isPending, isError } = useInventories()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[1.4rem] font-semibold text-pale">商品一覧</h1>
        <Link to="/products/new">
          <Button size="sm">新規作成</Button>
        </Link>
      </div>

      {isPending && <p className="text-dim text-sm">読み込み中...</p>}
      {isError && <p className="text-danger text-sm">商品の取得に失敗しました</p>}
      {data && data.length === 0 && <p className="text-dim text-sm">商品がありません</p>}
      {data && data.length > 0 && <InventoryTable inventories={data} />}
    </div>
  )
}

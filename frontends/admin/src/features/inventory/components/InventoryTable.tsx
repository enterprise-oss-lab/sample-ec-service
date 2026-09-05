import { Link } from 'react-router'
import { Table, Th, Td } from '@/shared/ui/Table'
import { StockAdjuster } from './StockAdjuster'
import type { Inventory } from '../api'

const ThumbnailPlaceholder = () => (
  <div className="w-10 h-10 rounded bg-sage-light/30 flex items-center justify-center">
    <svg viewBox="0 0 80 80" className="w-6 h-6 opacity-25">
      <rect x="20" y="20" width="40" height="40" rx="4" fill="none" stroke="#6b8c72" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="5" fill="#6b8c72" opacity="0.4" />
      <path d="M20 52 L32 40 L42 50 L52 38 L60 48 L60 60 L20 60 Z" fill="#6b8c72" opacity="0.2" />
    </svg>
  </div>
)

export const InventoryTable = ({ inventories }: { inventories: Inventory[] }) => (
  <Table>
    <thead>
      <tr>
        <Th>サムネイル</Th>
        <Th>商品名</Th>
        <Th>価格</Th>
        <Th>在庫数</Th>
        <Th>操作</Th>
      </tr>
    </thead>
    <tbody>
      {inventories.map((inventory) => (
        <tr key={inventory.id}>
          <Td>
            <ThumbnailPlaceholder />
          </Td>
          <Td>{inventory.name}</Td>
          <Td className="tabular-nums">¥{inventory.price.toLocaleString()}</Td>
          <Td>
            <StockAdjuster inventory={inventory} />
          </Td>
          <Td>
            <Link to={`/products/${inventory.id}/edit`} className="text-sage text-[0.8rem] hover:underline">
              編集
            </Link>
          </Td>
        </tr>
      ))}
    </tbody>
  </Table>
)

import { useProducts } from '../hooks/useProducts'

export const ProductList = () => {
  const { data, isPending, isError } = useProducts()

  if (isPending) return <p className="text-dim">Loading...</p>
  if (isError) return <p className="text-red-400">商品の取得に失敗しました</p>

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((product) => (
        <li key={product.id} className="bg-panel hover:bg-panel-hover rounded-lg p-4 transition-colors">
          <p className="font-display text-lg">{product.name}</p>
          <p className="text-gold font-mono">¥{product.price.toLocaleString()}</p>
          <p className="text-dim text-sm">在庫: {product.count}</p>
        </li>
      ))}
    </ul>
  )
}

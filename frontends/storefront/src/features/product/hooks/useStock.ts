import { useQuery } from '@tanstack/react-query'
import { STOCK_STALE_TIME, fetchStock } from '../api'

export function useStock(id: number) {
  return useQuery({
    queryKey: ['stocks', id],
    queryFn: () => fetchStock(id),
    staleTime: STOCK_STALE_TIME,
    enabled: Number.isFinite(id),
  })
}

import { useQuery } from '@tanstack/react-query'
import { STOCK_STALE_TIME, fetchStocks } from '../api'

export function useStocks() {
  return useQuery({
    queryKey: ['stocks'],
    queryFn: fetchStocks,
    staleTime: STOCK_STALE_TIME,
  })
}

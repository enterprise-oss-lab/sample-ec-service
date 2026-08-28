import { useQuery } from '@tanstack/react-query'
import { CATALOG_STALE_TIME, fetchProduct } from '../api'

export function useProduct(id: number) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => fetchProduct(id),
    staleTime: CATALOG_STALE_TIME,
    enabled: Number.isFinite(id),
  })
}

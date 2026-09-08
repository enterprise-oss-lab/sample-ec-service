import { useQuery } from '@tanstack/react-query'
import { CATALOG_STALE_TIME, fetchProducts } from '../api'

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: CATALOG_STALE_TIME,
  })
}

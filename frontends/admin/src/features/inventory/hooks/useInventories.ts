import { useQuery } from '@tanstack/react-query'
import { fetchInventories } from '../api'

export function useInventories() {
  return useQuery({
    queryKey: ['inventories'],
    queryFn: fetchInventories,
  })
}

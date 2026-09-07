import { useQuery } from '@tanstack/react-query'
import { fetchInventory } from '../api'

export function useInventory(id: number) {
  return useQuery({
    queryKey: ['inventories', id],
    queryFn: () => fetchInventory(id),
  })
}

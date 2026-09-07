import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { adjustStock } from '../api'

type Vars = { id: number; delta: number }
type Options = Pick<UseMutationOptions<void, Error, Vars>, 'onSuccess' | 'onError'>

export function useAdjustStock(options?: Options) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, delta }: Vars) => adjustStock(id, delta),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      options?.onSuccess?.(...args)
    },
    onError: options?.onError,
  })
}

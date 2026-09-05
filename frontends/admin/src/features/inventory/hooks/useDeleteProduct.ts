import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { deleteProduct } from '../api'

type Options = Pick<UseMutationOptions<void, Error, number>, 'onSuccess' | 'onError'>

export function useDeleteProduct(options?: Options) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      options?.onSuccess?.(...args)
    },
    onError: options?.onError,
  })
}

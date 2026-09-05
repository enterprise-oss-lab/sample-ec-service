import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { updateProduct, type UpdateProductRequest, type Inventory } from '../api'

type Vars = { id: number; req: UpdateProductRequest }
type Options = Pick<UseMutationOptions<Inventory, Error, Vars>, 'onSuccess' | 'onError'>

export function useUpdateProduct(options?: Options) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, req }: Vars) => updateProduct(id, req),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      options?.onSuccess?.(...args)
    },
    onError: options?.onError,
  })
}

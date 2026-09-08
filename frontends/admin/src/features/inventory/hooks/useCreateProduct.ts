import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { createProduct, type CreateProductRequest, type Inventory } from '../api'

type Options = Pick<UseMutationOptions<Inventory, Error, CreateProductRequest>, 'onSuccess' | 'onError'>

export function useCreateProduct(options?: Options) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateProductRequest) => createProduct(req),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      options?.onSuccess?.(...args)
    },
    onError: options?.onError,
  })
}

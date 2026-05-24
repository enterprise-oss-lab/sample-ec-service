import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { createOrder, type CreateOrderRequest } from '../api'

type Options = Pick<UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, Error, CreateOrderRequest>, 'onSuccess' | 'onError'>

export function useCreateOrder(options?: Options) {
  return useMutation({
    mutationFn: (req: CreateOrderRequest) => createOrder(req),
    ...options,
  })
}

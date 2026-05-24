import { useMutation } from '@tanstack/react-query'
import { createOrder, type CreateOrderRequest } from '../api'

export function useCreateOrder() {
  return useMutation({
    mutationFn: (req: CreateOrderRequest) => createOrder(req),
  })
}

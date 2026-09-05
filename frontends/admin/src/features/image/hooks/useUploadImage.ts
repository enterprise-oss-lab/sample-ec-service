import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { uploadImage } from '../api'

type Options = Pick<UseMutationOptions<string, Error, File>, 'onSuccess' | 'onError'>

export function useUploadImage(options?: Options) {
  return useMutation({
    mutationFn: (file: File) => uploadImage(file),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}

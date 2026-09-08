import { useEffect, useState, type ChangeEvent } from 'react'
import { imageUrl } from '@/shared/imageUrl'
import { useUploadImage } from '../hooks/useUploadImage'

interface ImageUploaderProps {
  imageKey: string | null
  onChange: (imageKey: string | null) => void
  disabled?: boolean
  onUploadingChange?: (isUploading: boolean) => void
}

export const ImageUploader = ({ imageKey, onChange, disabled, onUploadingChange }: ImageUploaderProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>()

  const { mutate, isPending } = useUploadImage({
    onSuccess: (key) => {
      setErrorMessage(undefined)
      onChange(key)
    },
    onError: (err) => {
      setErrorMessage(err.message)
      setPreviewUrl(null)
    },
  })

  useEffect(() => {
    onUploadingChange?.(isPending)
  }, [isPending, onUploadingChange])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    setErrorMessage(undefined)
    mutate(file)
  }

  const displayUrl = previewUrl ?? imageUrl(imageKey)

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="product-image" className="text-[0.8rem] font-medium text-soft">
        画像
      </label>
      {displayUrl && (
        <img
          src={displayUrl}
          alt="商品画像プレビュー"
          className="w-32 h-32 rounded object-cover border border-border"
        />
      )}
      <input
        id="product-image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={disabled || isPending}
        className="text-sm text-dim"
      />
      {isPending && <p className="text-[0.75rem] text-dim">アップロード中...</p>}
      {errorMessage && <p className="text-[0.75rem] text-danger">{errorMessage}</p>}
    </div>
  )
}

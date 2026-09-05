import { useState, type FormEvent } from 'react'
import { Input, Textarea } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { ImageUploader } from '@/features/image/components/ImageUploader'

export type ProductFormValues = {
  name: string
  price: number
  description: string
  count: number
  imageKey: string | null
}

interface ProductFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<ProductFormValues>
  onSubmit: (values: ProductFormValues) => void
  isSubmitting?: boolean
  errorMessage?: string
}

export const ProductForm = ({ mode, initialValues, onSubmit, isSubmitting, errorMessage }: ProductFormProps) => {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [price, setPrice] = useState(initialValues?.price ?? 0)
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [count, setCount] = useState(initialValues?.count ?? 0)
  const [imageKey, setImageKey] = useState(initialValues?.imageKey ?? null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ name, price, description, count, imageKey })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <Input
        id="product-name"
        label="商品名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        id="product-price"
        label="価格"
        type="number"
        min={0}
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        required
      />
      <Textarea
        id="product-description"
        label="説明"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
      />
      <ImageUploader imageKey={imageKey} onChange={setImageKey} disabled={isSubmitting} />
      {mode === 'create' && (
        <Input
          id="product-count"
          label="初期在庫数"
          type="number"
          min={0}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          required
        />
      )}
      {errorMessage && <p className="text-danger text-sm">{errorMessage}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '保存中...' : '保存する'}
      </Button>
    </form>
  )
}

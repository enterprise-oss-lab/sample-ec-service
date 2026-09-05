import { useNavigate } from 'react-router'
import { ProductForm } from '@/features/inventory/components/ProductForm'
import { useCreateProduct } from '@/features/inventory/hooks/useCreateProduct'
import { useFlash } from '@/shared/Flash'

export const ProductNewPage = () => {
  const navigate = useNavigate()
  const { flash } = useFlash()
  const { mutate, isPending, error } = useCreateProduct({
    onSuccess: () => {
      flash('商品を作成しました')
      navigate('/')
    },
  })

  return (
    <div>
      <h1 className="text-[1.4rem] font-semibold text-pale mb-6">商品を作成</h1>
      <ProductForm
        mode="create"
        onSubmit={(values) =>
          mutate({
            name: values.name,
            price: values.price,
            description: values.description,
            image_key: values.imageKey,
            count: values.count,
          })
        }
        isSubmitting={isPending}
        errorMessage={error?.message}
      />
    </div>
  )
}

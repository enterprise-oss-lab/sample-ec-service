import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ProductForm } from '@/features/inventory/components/ProductForm'
import { useInventory } from '@/features/inventory/hooks/useInventory'
import { useUpdateProduct } from '@/features/inventory/hooks/useUpdateProduct'
import { useDeleteProduct } from '@/features/inventory/hooks/useDeleteProduct'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Button } from '@/shared/ui/Button'
import { useFlash } from '@/shared/Flash'

export const ProductEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const inventoryId = Number(id)
  const navigate = useNavigate()
  const { flash } = useFlash()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data, isPending: isLoading, isError } = useInventory(inventoryId)

  const { mutate: update, isPending: isUpdating, error: updateError } = useUpdateProduct({
    onSuccess: () => {
      flash('商品を更新しました')
      navigate('/')
    },
  })
  const { mutate: remove, isPending: isDeleting } = useDeleteProduct({
    onSuccess: () => {
      flash('商品を削除しました')
      navigate('/')
    },
    onError: (err) => {
      flash(err.message, 'error')
      setConfirmOpen(false)
    },
  })

  if (isLoading) return <p className="text-dim text-sm">読み込み中...</p>
  if (isError || !data) return <p className="text-danger text-sm">商品の取得に失敗しました</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[1.4rem] font-semibold text-pale">商品を編集</h1>
        <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
          削除する
        </Button>
      </div>
      <ProductForm
        mode="edit"
        initialValues={{
          name: data.name,
          price: data.price,
          description: data.description,
          imageKey: data.imageKey,
        }}
        onSubmit={(values) =>
          update({
            id: inventoryId,
            req: {
              name: values.name,
              price: values.price,
              description: values.description,
              image_key: values.imageKey,
            },
          })
        }
        isSubmitting={isUpdating}
        errorMessage={updateError?.message}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="商品を削除しますか？"
        message="この操作は取り消せません。"
        onConfirm={() => remove(inventoryId)}
        onCancel={() => setConfirmOpen(false)}
        isConfirming={isDeleting}
      />
    </div>
  )
}

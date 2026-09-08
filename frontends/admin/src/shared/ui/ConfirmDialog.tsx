import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  isConfirming?: boolean
}

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = '削除する',
  cancelLabel = 'キャンセル',
  onConfirm,
  onCancel,
  isConfirming,
}: ConfirmDialogProps) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-lg bg-canvas border border-border p-6 shadow-lg">
        <h2 className="text-[1rem] font-semibold text-pale mb-2">{title}</h2>
        <p className="text-sm text-dim mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? '削除中...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

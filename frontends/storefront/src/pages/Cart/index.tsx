import { useEffect, useRef } from 'react'
import { useFlash } from '@/shared/Flash'

export const CartPage = () => {
  const { flash } = useFlash()
  const fired = useRef(false)

  // StrictMode では開発時にエフェクトが2回実行されるため ref でガード
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    flash('カートはまだ実装していません', 'error')
  }, [])

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl mb-6">カート</h1>
    </main>
  )
}

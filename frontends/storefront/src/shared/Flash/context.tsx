import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type FlashType = 'success' | 'error'

export interface FlashMessage {
  id: number
  message: string
  type: FlashType
}

interface FlashContextValue {
  messages: FlashMessage[]
  flash: (message: string, type?: FlashType) => void
  dismiss: (id: number) => void
}

const FlashContext = createContext<FlashContextValue | null>(null)

let seq = 0

export function FlashProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<FlashMessage[]>([])

  const dismiss = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const flash = useCallback(
    (message: string, type: FlashType = 'success') => {
      const id = seq++
      setMessages((prev) => [...prev, { id, message, type }])
      setTimeout(() => dismiss(id), 3500)
    },
    [dismiss],
  )

  return (
    <FlashContext.Provider value={{ messages, flash, dismiss }}>
      {children}
    </FlashContext.Provider>
  )
}

export function useFlash() {
  const ctx = useContext(FlashContext)
  if (!ctx) throw new Error('useFlash must be used within FlashProvider')
  return ctx
}

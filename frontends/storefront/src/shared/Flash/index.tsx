import { useFlash } from './context'

export { FlashProvider, useFlash } from './context'

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export const Flash = () => {
  const { messages, dismiss } = useFlash()

  if (messages.length === 0) return null

  return (
    <div className="fixed top-20 inset-x-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4">
      {messages.map(({ id, message, type }) => (
        <div
          key={id}
          className="animate-fade-in-up pointer-events-auto flex items-center gap-3 rounded border px-4 py-3 text-sm"
          style={{
            background: type === 'success' ? 'rgba(200,164,106,0.10)' : 'rgba(220,80,80,0.10)',
            borderColor: type === 'success' ? 'rgba(200,164,106,0.45)' : 'rgba(220,80,80,0.45)',
            color: type === 'success' ? '#c8a46a' : '#e06060',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span className="shrink-0">
            {type === 'success' ? <CheckIcon /> : <XIcon />}
          </span>
          <span className="tracking-wide">{message}</span>
          <button
            onClick={() => dismiss(id)}
            aria-label="閉じる"
            className="ml-2 shrink-0 opacity-50 hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-none p-0"
            style={{ color: 'inherit' }}
          >
            <XIcon />
          </button>
        </div>
      ))}
    </div>
  )
}

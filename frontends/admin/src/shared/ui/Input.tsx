import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-[0.8rem] font-medium text-soft">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={[
          'rounded border bg-transparent px-3 py-2 text-sm text-pale',
          'focus:outline-none focus:ring-1 focus:ring-sage/40 focus:border-sage/60',
          'transition-colors duration-150',
          error ? 'border-danger/50' : 'border-border',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-[0.75rem] text-danger">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-[0.8rem] font-medium text-soft">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={[
          'rounded border bg-transparent px-3 py-2 text-sm text-pale',
          'focus:outline-none focus:ring-1 focus:ring-sage/40 focus:border-sage/60',
          'transition-colors duration-150',
          error ? 'border-danger/50' : 'border-border',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-[0.75rem] text-danger">{error}</p>}
    </div>
  ),
)
Textarea.displayName = 'Textarea'

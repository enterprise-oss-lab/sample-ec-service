import { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-sage text-white border border-sage hover:bg-[#4d6b54] hover:border-[#4d6b54]',
  secondary: 'bg-transparent text-sage border border-sage hover:bg-sage-light',
  ghost:     'bg-transparent text-soft border border-border hover:border-sage hover:text-sage',
  danger:    'bg-transparent text-danger border border-danger/40 hover:bg-danger-light',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) => (
  <button
    {...props}
    className={[
      'inline-flex items-center justify-center gap-2',
      'font-medium rounded tracking-wide',
      'transition-colors duration-150',
      'cursor-pointer',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      variantClasses[variant],
      sizeClasses[size],
      className,
    ].join(' ')}
  >
    {children}
  </button>
)

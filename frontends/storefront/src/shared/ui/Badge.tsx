interface BadgeProps {
  children: React.ReactNode
  variant?: 'new' | 'popular' | 'default'
}

export const Badge = ({ children, variant = 'default' }: BadgeProps) => {
  const classes = {
    new:     'bg-sage-light text-sage border border-sage/30',
    popular: 'bg-pale/5 text-pale border border-pale/20',
    default: 'bg-panel text-dim border border-border',
  }[variant]

  return (
    <span className={`inline-block text-[0.65rem] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-sm ${classes}`}>
      {children}
    </span>
  )
}

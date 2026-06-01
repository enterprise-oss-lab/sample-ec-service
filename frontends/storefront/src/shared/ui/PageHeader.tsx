interface PageHeaderProps {
  title: string
  label?: string
}

export const PageHeader = ({ title, label }: PageHeaderProps) => (
  <div className="mb-10 pb-6 border-b border-border">
    {label && (
      <p className="text-[0.68rem] tracking-[0.18em] text-dim uppercase mb-2">{label}</p>
    )}
    <h1 className="text-[1.75rem] font-semibold text-pale">{title}</h1>
  </div>
)

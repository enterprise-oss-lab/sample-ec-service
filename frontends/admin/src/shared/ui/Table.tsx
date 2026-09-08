import { type TableHTMLAttributes, type ThHTMLAttributes, type TdHTMLAttributes } from 'react'

export const Table = ({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) => (
  <table className={`w-full border-collapse text-sm ${className}`} {...props} />
)

export const Th = ({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={`text-left font-medium text-dim text-[0.75rem] uppercase tracking-wide px-3 py-2 border-b border-border ${className}`}
    {...props}
  />
)

export const Td = ({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={`px-3 py-3 border-b border-border text-pale ${className}`} {...props} />
)

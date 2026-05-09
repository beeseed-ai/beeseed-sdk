import { useState, useRef, useEffect, type ReactNode } from 'react'
import { cn } from '../../lib/cn.js'

interface DropdownMenuProps { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end'; className?: string }

export function DropdownMenu({ trigger, children, align = 'start', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className={cn(
          'absolute top-full z-50 mt-1 min-w-[160px] rounded-lg border bg-background p-1 shadow-lg',
          align === 'end' ? 'right-0' : 'left-0',
          className,
        )} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps { children: ReactNode; onClick?: () => void; destructive?: boolean; className?: string }

export function DropdownItem({ children, onClick, destructive, className }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        destructive ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-muted',
        className,
      )}
    >{children}</button>
  )
}

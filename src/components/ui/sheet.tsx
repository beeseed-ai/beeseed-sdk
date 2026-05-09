import { useEffect, type ReactNode } from 'react'
import { cn } from '../../lib/cn.js'

interface Props {
  open: boolean
  onClose: () => void
  side?: 'left' | 'right'
  children: ReactNode
  className?: string
}

export function Sheet({ open, onClose, side = 'right', children, className }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className={cn(
        'fixed inset-y-0 z-50 flex flex-col bg-background shadow-xl transition-transform duration-300',
        side === 'right' ? 'right-0 w-[360px]' : 'left-0 w-[360px]',
        className,
      )}>
        {children}
      </div>
    </>
  )
}

export function SheetHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between border-b px-4 py-3', className)}>{children}</div>
}

export function SheetContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex-1 overflow-y-auto', className)}>{children}</div>
}

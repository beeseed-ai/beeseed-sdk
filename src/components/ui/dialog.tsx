import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { Button } from './button.js'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false) }}
    >
      <div className="fixed inset-0 bg-black/10 backdrop-blur-xs" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onClose,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean; onClose?: () => void }) {
  return (
    <div
      className={cn(
        'w-[min(100vw-2rem,28rem)] max-w-none rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 shadow-lg',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && onClose && (
        <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" onClick={onClose}>
          <X />
        </Button>
      )}
    </div>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-base font-medium leading-none', className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }

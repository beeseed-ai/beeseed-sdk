import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn.js'

interface Props {
  content: string
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}

export function Tooltip({ content, children, side = 'top', className }: Props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className={cn(
          'absolute z-50 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-md',
          side === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-1' : 'top-full left-1/2 -translate-x-1/2 mt-1',
          className,
        )}>
          {content}
        </div>
      )}
    </div>
  )
}

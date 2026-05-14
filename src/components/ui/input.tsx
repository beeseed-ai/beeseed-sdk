import * as React from 'react'
import { cn } from '../../lib/cn.js'

function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-border bg-white px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-[#9297a0] focus-visible:ring-2 focus-visible:ring-[#9297a0]/20 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

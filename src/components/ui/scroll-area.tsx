import * as React from 'react'
import { cn } from '../../lib/cn.js'

interface ScrollAreaProps extends React.ComponentProps<'div'> {
  viewportRef?: React.Ref<HTMLDivElement>
}

function ScrollArea({ className, children, viewportRef, ...props }: ScrollAreaProps) {
  return (
    <div className={cn('relative overflow-hidden', className)} {...props}>
      <div
        ref={viewportRef}
        className="size-full overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
    </div>
  )
}

export { ScrollArea }

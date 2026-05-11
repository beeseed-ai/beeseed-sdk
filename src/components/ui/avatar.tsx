import * as React from 'react'
import { cn } from '../../lib/cn.js'

function Avatar({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground select-none overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function AvatarImage({ className, src, alt, ...props }: React.ComponentProps<'img'>) {
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      className={cn('absolute inset-0 size-full rounded-full object-cover', className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  children,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Avatar, AvatarImage, AvatarFallback }

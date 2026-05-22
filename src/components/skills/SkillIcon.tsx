import { Sparkles } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn.js'

interface SkillIconProps {
  name?: string
  iconUrl?: string
  alt?: string
  className?: string
  imageClassName?: string
  fallback?: ReactNode
}

export function skillIconUrl(name?: string) {
  const trimmed = name?.trim()
  return trimmed ? `/skill-icons/${encodeURIComponent(trimmed)}.png` : ''
}

export function SkillIcon({
  name,
  iconUrl,
  alt = '',
  className,
  imageClassName,
  fallback,
}: SkillIconProps) {
  const src = iconUrl || skillIconUrl(name)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#f8fafc] text-[#254fad]', className)}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          className={cn('size-full object-cover', imageClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        fallback ?? <Sparkles className="size-3.5" />
      )}
    </span>
  )
}

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

const SKILL_ICON_ALIASES: Record<string, string> = {
  'ppt-master': 'guizang-ppt-skill',
  'single-acupoint-research': 'med-topic-finder',
  'single-disease-research': 'med-lit-review',
  'single-ease-research': 'med-research-writer',
  'single--ease-research': 'med-research-writer',
}

function normalizeSkillIconName(name?: string) {
  const trimmed = name?.trim()
  return trimmed ? (SKILL_ICON_ALIASES[trimmed] ?? trimmed) : ''
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function skillIconUrl(name?: string) {
  const trimmed = normalizeSkillIconName(name)
  return trimmed ? `/skill-icons/${encodeURIComponent(trimmed)}.png` : ''
}

function normalizeSkillIconUrl(iconUrl?: string, name?: string) {
  const src = iconUrl?.trim()
  if (!src) return skillIconUrl(name)
  const match = src.match(/^(.*\/skill-icons\/)([^/?#]+)(\.png)([?#].*)?$/)
  if (!match) return src
  const decoded = safeDecodeURIComponent(match[2])
  const normalized = normalizeSkillIconName(decoded)
  if (!normalized || normalized === decoded) return src
  return `${match[1]}${encodeURIComponent(normalized)}${match[3]}${match[4] ?? ''}`
}

export function SkillIcon({
  name,
  iconUrl,
  alt = '',
  className,
  imageClassName,
  fallback,
}: SkillIconProps) {
  const src = normalizeSkillIconUrl(iconUrl, name)
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

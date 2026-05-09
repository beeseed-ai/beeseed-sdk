import { useEffect, useRef } from 'react'
import type { RoomMemberInfo } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'

interface Props {
  members: RoomMemberInfo[]
  query: string
  selectedIndex: number
  onSelect: (member: RoomMemberInfo) => void
  onClose: () => void
}

function filterMembers(members: RoomMemberInfo[], query: string): RoomMemberInfo[] {
  const q = query.toLowerCase()
  return members.filter((m) =>
    m.display_name.toLowerCase().includes(q) ||
    (m.chinese_name?.toLowerCase().includes(q) ?? false),
  )
}

export function getFilteredCount(members: RoomMemberInfo[], query: string): number {
  return filterMembers(members, query).length
}

export function getFilteredMember(members: RoomMemberInfo[], query: string, index: number): RoomMemberInfo | undefined {
  return filterMembers(members, query)[index]
}

export function MentionMenu({ members, query, selectedIndex, onSelect, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  const filtered = filterMembers(members, query)

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (filtered.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-2 mb-1 z-50 w-56 max-h-52 overflow-y-auto rounded-lg border border-border bg-background shadow-lg"
    >
      {filtered.map((m, i) => {
        const id = m.agent_id ?? m.user_id ?? i
        return (
          <div
            key={id}
            ref={(el) => { itemRefs.current[i] = el }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 cursor-pointer text-sm',
              i === selectedIndex
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
            onMouseDown={(e) => { e.preventDefault(); onSelect(m) }}
          >
            <Avatar className="size-6 shrink-0">
              {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
              <AvatarFallback className="text-[10px]">
                {m.member_type === 'agent' ? '🤖' : m.display_name[0]}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">
              {m.chinese_name && m.chinese_name !== m.display_name
                ? `${m.display_name}（${m.chinese_name}）`
                : m.display_name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

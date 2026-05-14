import type { ChannelWithMeta } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { ScrollArea } from '../ui/scroll-area.js'
import { ChannelItem } from './ChannelItem.js'

interface Props {
  channels: ChannelWithMeta[]
  currentChannelId: string | null
  onSelectChannel: (channel: ChannelWithMeta) => void
  header?: React.ReactNode
  className?: string
}

export function ChannelList({ channels, currentChannelId, onSelectChannel, header, className }: Props) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      {header}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {channels.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              暂无对话
            </div>
          ) : (
            channels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                active={channel.id === currentChannelId}
                onClick={() => onSelectChannel(channel)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

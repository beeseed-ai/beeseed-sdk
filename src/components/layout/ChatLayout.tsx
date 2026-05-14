import { useState } from 'react'
import { Plus, LogOut, ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useChannels } from '../../hooks/use-channels.js'
import { useConnection } from '../../hooks/use-connection.js'
import type { ChannelWithMeta } from '../../core/types.js'
import { ChannelList } from '../channels/ChannelList.js'
import { ChannelHeader } from '../channels/ChannelHeader.js'
import { CreateChannelDialog } from '../channels/CreateChannelDialog.js'
import { ChatChannel } from '../chat/ChatChannel.js'
import { Button } from '../ui/button.js'

interface Props {
  className?: string
}

export function ChatLayout({ className }: Props) {
  const { user, signOut } = useAuth()
  const { channels, currentChannelId, joinChannel } = useChannels()
  const { state: connState } = useConnection()
  const [showCreateChannel, setShowCreateChannel] = useState(false)

  const currentChannel = channels?.find((r) => r.id === currentChannelId) ?? null

  function handleSelectChannel(channel: ChannelWithMeta) {
    joinChannel(channel.id)
  }

  function handleBack() {
    joinChannel(null as unknown as string)
  }

  const sidebarHeader = (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <h2 className="text-sm font-bold">对话</h2>
      <Button variant="ghost" size="icon-sm" onClick={() => setShowCreateChannel(true)}>
        <Plus className="size-4" />
      </Button>
    </div>
  )

  const sidebarFooter = (
    <div className="flex items-center justify-between border-t px-4 py-2">
      <span className="text-xs text-muted-foreground truncate">{user?.name}</span>
      <Button variant="ghost" size="icon-sm" onClick={signOut}>
        <LogOut className="size-3.5" />
      </Button>
    </div>
  )

  return (
    <div className={cn('flex h-screen bg-background', className)}>
      {/* Sidebar — hidden on mobile when a channel is selected */}
      <div
        className={cn(
          'flex w-full flex-col border-r sm:w-72 sm:flex',
          currentChannelId ? 'hidden sm:flex' : 'flex',
        )}
      >
        {connState === 'reconnecting' && (
          <div className="bg-warning/20 px-4 py-1 text-center text-xs text-warning-foreground">
            重新连接中...
          </div>
        )}
        <ChannelList
          channels={channels}
          currentChannelId={currentChannelId}
          onSelectChannel={handleSelectChannel}
          header={sidebarHeader}
          className="flex-1"
        />
        {sidebarFooter}
      </div>

      {/* Chat area — hidden on mobile when no channel selected */}
      <div
        className={cn(
          'flex-1 flex-col',
          currentChannelId ? 'flex' : 'hidden sm:flex',
        )}
      >
        {currentChannel ? (
          <ChatChannel
            channelId={currentChannel.id}
            header={
              <ChannelHeader
                channel={currentChannel}
                leading={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="sm:hidden"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                }
              />
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-muted-foreground">选择一个对话开始聊天</span>
          </div>
        )}
      </div>

      <CreateChannelDialog open={showCreateChannel} onOpenChange={setShowCreateChannel} />
    </div>
  )
}

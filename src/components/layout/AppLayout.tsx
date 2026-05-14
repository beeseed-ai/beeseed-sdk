import { lazy, Suspense, useEffect, useState } from 'react'
import { PanelRight } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useChannels } from '../../hooks/use-channels.js'
import { useChat } from '../../hooks/use-chat.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { useTasks } from '../../hooks/use-tasks.js'
import { useAuth } from '../../hooks/use-auth.js'
import { ChatChannel } from '../chat/ChatChannel.js'
import { ChannelHeader } from '../channels/ChannelHeader.js'
import { LeftNavSidebar } from './LeftNavSidebar.js'
import { DetailPanel } from './DetailPanel.js'

const TaskPanel = lazy(() => import('../tasks/TaskPanel.js').then((m) => ({ default: m.TaskPanel })))
const KnowledgePanel = lazy(() => import('../knowledge/KnowledgePanel.js').then((m) => ({ default: m.KnowledgePanel })))
const CronPanel = lazy(() => import('../cron/CronPanel.js').then((m) => ({ default: m.CronPanel })))
const AdminPanel = lazy(() => import('../admin/AdminPanel.js').then((m) => ({ default: m.AdminPanel })))

interface Props { className?: string }

function FeatureLoading() {
  return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-muted-foreground">加载中...</span></div>
}

export function AppLayout({ className }: Props) {
  const { channels, currentChannelId, setCurrentChannel } = useChannels()
  const { user } = useAuth()
  const { activeFeature, setActiveFeature, panelVisible, togglePanel, setPanel } = useDetailPanel()
  const { members, refreshMembers } = useChat(currentChannelId)
  const { tasks } = useTasks(currentChannelId)
  const [createTaskRequest, setCreateTaskRequest] = useState(0)
  const isAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    if (activeFeature === 'admin' && !isAdmin) {
      setActiveFeature('chat')
    }
  }, [activeFeature, isAdmin, setActiveFeature])

  const handleChannelSelect = (channelId: string) => {
    setCurrentChannel(channelId)
    setActiveFeature('chat')
    setPanel(true)
  }

  const currentChannel = channels.find((r) => r.id === currentChannelId)

  const openTaskCreator = () => {
    setActiveFeature('tasks')
    setCreateTaskRequest((value) => value + 1)
  }

  return (
    <div className={cn('flex h-[100dvh] bg-background', className)}>
      <LeftNavSidebar
        className={activeFeature === 'chat' && currentChannelId ? 'hidden md:flex' : undefined}
        activeFeature={activeFeature}
        onFeatureChange={setActiveFeature}
        channels={channels}
        currentChannelId={currentChannelId}
        onChannelSelect={handleChannelSelect}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {activeFeature === 'chat' && currentChannelId ? (
          <ChatChannel
            channelId={currentChannelId}
            header={
              <ChannelHeader
                channel={currentChannel ?? null}
                trailing={
                  <button
                    onClick={togglePanel}
                    className={cn('p-1.5 rounded-md hover:bg-black/5 transition-colors', panelVisible && 'bg-black/5')}
                    title="详情面板"
                  >
                    <PanelRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                }
              />
            }
          />
        ) : activeFeature === 'chat' ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">选择一个对话开始聊天</div>
        ) : (
          <Suspense fallback={<FeatureLoading />}>
            {activeFeature === 'tasks' && <TaskPanel channelId={currentChannelId} members={members} createTaskRequest={createTaskRequest} />}
            {activeFeature === 'knowledge' && <KnowledgePanel />}
            {activeFeature === 'cron' && <CronPanel channelId={currentChannelId} />}
            {activeFeature === 'admin' && isAdmin && <AdminPanel />}
          </Suspense>
        )}
      </div>

      {activeFeature === 'chat' && (
        <DetailPanel
          className="hidden lg:flex"
          channelId={currentChannelId}
          members={members}
          tasks={tasks}
          onCreateTask={openTaskCreator}
          onMembersChanged={refreshMembers}
        />
      )}
    </div>
  )
}

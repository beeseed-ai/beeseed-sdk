import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Menu, PanelRight } from 'lucide-react'
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

interface Props {
  className?: string
  sidebarFooterMeta?: ReactNode
}

function FeatureLoading() {
  return <div className="flex-1 flex items-center justify-center bg-[#fafafa]"><span className="text-sm text-muted-foreground">加载中...</span></div>
}

export function AppLayout({ className, sidebarFooterMeta }: Props) {
  const { channels, currentChannelId, setCurrentChannel } = useChannels()
  const { user } = useAuth()
  const { activeFeature, setActiveFeature, panelVisible, togglePanel, setPanel } = useDetailPanel()
  const { members, refreshMembers } = useChat(currentChannelId)
  const { tasks } = useTasks(currentChannelId)
  const [createTaskRequest, setCreateTaskRequest] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
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
    setMobileNavOpen(false)
    setMobileDetailOpen(false)
  }

  const currentChannel = channels.find((r) => r.id === currentChannelId)

  const openTaskCreator = () => {
    setActiveFeature('tasks')
    setCreateTaskRequest((value) => value + 1)
  }
  const handleFeatureChange = (feature: Parameters<typeof setActiveFeature>[0]) => {
    setActiveFeature(feature)
    setMobileNavOpen(false)
  }

  return (
    <div className={cn('flex h-[100dvh] bg-[#fafafa]', className)}>
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="关闭导航"
        />
      )}
      <LeftNavSidebar
        className={mobileNavOpen
          ? 'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-2rem))] max-w-[18rem] shadow-xl md:static md:w-[200px] md:max-w-none md:shadow-none'
          : 'hidden md:flex'}
        activeFeature={activeFeature}
        onFeatureChange={handleFeatureChange}
        channels={channels}
        currentChannelId={currentChannelId}
        onChannelSelect={handleChannelSelect}
        footerMeta={sidebarFooterMeta}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {activeFeature === 'chat' && currentChannelId ? (
          <ChatChannel
            channelId={currentChannelId}
            header={
              <ChannelHeader
                channel={currentChannel ?? null}
                leading={
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dddddd] bg-white text-[#41454d] transition-colors hover:border-[#9297a0] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35 md:hidden"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="打开导航"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                }
                trailing={
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPanel(true)
                        setMobileDetailOpen(true)
                      }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35 lg:hidden"
                      title="详情面板"
                    >
                      <PanelRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={togglePanel}
                      className={cn('hidden h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35 lg:inline-flex', panelVisible && 'bg-black/5')}
                      title="详情面板"
                    >
                      <PanelRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </>
                }
              />
            }
          />
        ) : activeFeature === 'chat' ? (
          <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa]">
            <div className="flex min-h-12 items-center border-b border-border bg-white px-3 py-2.5 md:hidden">
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dddddd] bg-white text-[#41454d] transition-colors hover:border-[#9297a0] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35"
                onClick={() => setMobileNavOpen(true)}
                aria-label="打开导航"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 p-4 sm:p-8">
              <div className="mx-auto flex h-full max-w-5xl items-center justify-center rounded-xl border border-border bg-white px-4 text-center text-sm text-muted-foreground shadow-sm">
                选择一个对话开始聊天
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-12 items-center border-b border-border bg-white px-3 py-2.5 md:hidden">
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dddddd] bg-white text-[#41454d] transition-colors hover:border-[#9297a0] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35"
                onClick={() => setMobileNavOpen(true)}
                aria-label="打开导航"
              >
                <Menu className="h-4 w-4" />
              </button>
              <span className="ml-2 min-w-0 truncate text-sm font-semibold">
                {activeFeature === 'tasks' ? '任务' : activeFeature === 'knowledge' ? '知识库' : activeFeature === 'admin' ? '管理后台' : '自动任务'}
              </span>
            </div>
            <Suspense fallback={<FeatureLoading />}>
              {activeFeature === 'tasks' && <TaskPanel channelId={currentChannelId} members={members} createTaskRequest={createTaskRequest} />}
              {activeFeature === 'knowledge' && <KnowledgePanel />}
              {activeFeature === 'cron' && <CronPanel channelId={currentChannelId} />}
              {activeFeature === 'admin' && isAdmin && <AdminPanel />}
            </Suspense>
          </div>
        )}
      </div>

      {activeFeature === 'chat' && mobileDetailOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/25 lg:hidden"
          onClick={() => setMobileDetailOpen(false)}
          aria-label="关闭详情面板"
        />
      )}
      {activeFeature === 'chat' && (
        <DetailPanel
          className={cn(
            mobileDetailOpen ? 'fixed inset-y-0 right-0 z-40 flex w-[min(22rem,calc(100vw-2rem))] max-w-[22rem] shadow-xl' : 'hidden',
            'lg:static lg:z-auto lg:flex lg:w-[300px] lg:max-w-none lg:shadow-none',
          )}
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

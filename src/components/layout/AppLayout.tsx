import { lazy, Suspense } from 'react'
import { PanelRight } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useRooms } from '../../hooks/use-rooms.js'
import { useChat } from '../../hooks/use-chat.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { useTasks } from '../../hooks/use-tasks.js'
import { ChatRoom } from '../chat/ChatRoom.js'
import { RoomHeader } from '../rooms/RoomHeader.js'
import { LeftNavSidebar } from './LeftNavSidebar.js'
import { DetailPanel } from './DetailPanel.js'

const TaskPanel = lazy(() => import('../tasks/TaskPanel.js').then((m) => ({ default: m.TaskPanel })))
const KnowledgePanel = lazy(() => import('../knowledge/KnowledgePanel.js').then((m) => ({ default: m.KnowledgePanel })))
const CloudStoragePanel = lazy(() => import('../storage/CloudStoragePanel.js').then((m) => ({ default: m.CloudStoragePanel })))
const AgentManagePanel = lazy(() => import('../agents/AgentManagePanel.js').then((m) => ({ default: m.AgentManagePanel })))
const CronPanel = lazy(() => import('../cron/CronPanel.js').then((m) => ({ default: m.CronPanel })))
const AdminPanel = lazy(() => import('../admin/AdminPanel.js').then((m) => ({ default: m.AdminPanel })))

interface Props { className?: string }

function FeatureLoading() {
  return <div className="flex-1 flex items-center justify-center"><span className="text-sm text-muted-foreground">加载中...</span></div>
}

export function AppLayout({ className }: Props) {
  const { rooms, currentRoomId, setCurrentRoom, createRoom } = useRooms()
  const { activeFeature, setActiveFeature, panelVisible, togglePanel, setPanel } = useDetailPanel()
  const { members } = useChat(currentRoomId)
  const { tasks } = useTasks(currentRoomId)

  const handleRoomSelect = (roomId: string) => {
    setCurrentRoom(roomId)
    setActiveFeature('chat')
    setPanel(true)
  }

  const handleCreateRoom = (name: string, agentIds: string[]) => {
    void createRoom(name, agentIds)
  }

  const currentRoom = rooms.find((r) => r.id === currentRoomId)

  return (
    <div className={cn('flex h-[100dvh] bg-background', className)}>
      <LeftNavSidebar
        className={activeFeature === 'chat' && currentRoomId ? 'hidden md:flex' : undefined}
        activeFeature={activeFeature}
        onFeatureChange={setActiveFeature}
        rooms={rooms}
        currentRoomId={currentRoomId}
        onRoomSelect={handleRoomSelect}
        onCreateRoom={handleCreateRoom}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {activeFeature === 'chat' && currentRoomId ? (
          <ChatRoom
            roomId={currentRoomId}
            header={
              <RoomHeader
                room={currentRoom ?? null}
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
            {activeFeature === 'tasks' && <TaskPanel roomId={currentRoomId} />}
            {activeFeature === 'knowledge' && <KnowledgePanel />}
            {activeFeature === 'storage' && <CloudStoragePanel roomId={currentRoomId} />}
            {activeFeature === 'agents' && <AgentManagePanel />}
            {activeFeature === 'cron' && <CronPanel roomId={currentRoomId} />}
            {activeFeature === 'admin' && <AdminPanel />}
          </Suspense>
        )}
      </div>

      {activeFeature === 'chat' && (
        <DetailPanel
          className="hidden lg:flex"
          roomId={currentRoomId}
          members={members}
          tasks={tasks}
        />
      )}
    </div>
  )
}

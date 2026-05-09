import { lazy, Suspense } from 'react'
import { cn } from '../../lib/cn.js'
import { useRooms } from '../../hooks/use-rooms.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { ChatRoom } from '../chat/ChatRoom.js'
import { RoomHeader } from '../rooms/RoomHeader.js'
import { LeftNavSidebar } from './LeftNavSidebar.js'
import { DetailPanel } from './DetailPanel.js'

const TaskPanel = lazy(() => import('../tasks/TaskPanel.js').then((m) => ({ default: m.TaskPanel })))
const KnowledgePanel = lazy(() => import('../knowledge/KnowledgePanel.js').then((m) => ({ default: m.KnowledgePanel })))
const CloudStoragePanel = lazy(() => import('../storage/CloudStoragePanel.js').then((m) => ({ default: m.CloudStoragePanel })))
const AgentManagePanel = lazy(() => import('../agents/AgentManagePanel.js').then((m) => ({ default: m.AgentManagePanel })))
const CronPanel = lazy(() => import('../cron/CronPanel.js').then((m) => ({ default: m.CronPanel })))

interface Props {
  className?: string
}

function FeatureLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <span className="text-sm text-muted-foreground">加载中...</span>
    </div>
  )
}

export function AppLayout({ className }: Props) {
  const { rooms, currentRoomId, setCurrentRoom, createRoom } = useRooms()
  const { activeFeature, setActiveFeature, panelVisible, togglePanel } = useDetailPanel()

  const handleRoomSelect = (roomId: string) => {
    setCurrentRoom(roomId)
    setActiveFeature('chat')
  }

  const handleCreateRoom = (name: string, agentIds: string[]) => {
    void createRoom(name, agentIds)
  }

  const currentRoom = rooms.find((r) => r.id === currentRoomId)

  return (
    <div className={cn('flex h-[100dvh] bg-background', className)}>
      {/* Left sidebar */}
      <LeftNavSidebar
        activeFeature={activeFeature}
        onFeatureChange={setActiveFeature}
        rooms={rooms}
        currentRoomId={currentRoomId}
        onRoomSelect={handleRoomSelect}
        onCreateRoom={handleCreateRoom}
      />

      {/* Center content */}
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
                    className={cn('p-1 rounded hover:bg-muted transition-colors', panelVisible && 'bg-muted')}
                    title="详情面板"
                  >
                    <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                  </button>
                }
              />
            }
          />
        ) : activeFeature === 'chat' ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            选择一个对话开始聊天
          </div>
        ) : (
          <Suspense fallback={<FeatureLoading />}>
            {activeFeature === 'tasks' && <TaskPanel roomId={currentRoomId} />}
            {activeFeature === 'knowledge' && <KnowledgePanel />}
            {activeFeature === 'storage' && <CloudStoragePanel roomId={currentRoomId} />}
            {activeFeature === 'agents' && <AgentManagePanel />}
            {activeFeature === 'cron' && <CronPanel roomId={currentRoomId} />}
          </Suspense>
        )}
      </div>

      {/* Right detail panel (only in chat mode) */}
      {activeFeature === 'chat' && <DetailPanel roomId={currentRoomId} />}
    </div>
  )
}

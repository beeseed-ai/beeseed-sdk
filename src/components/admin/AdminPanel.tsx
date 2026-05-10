import { useState } from 'react'
import { Bot, Users, MessageSquare, Settings } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { AgentManageTab } from './AgentManageTab.js'

const tabs = [
  { id: 'agents', label: 'Agent 管理', icon: Bot },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'rooms', label: 'Room 管理', icon: MessageSquare },
  { id: 'settings', label: '设置', icon: Settings },
] as const

type TabId = (typeof tabs)[number]['id']

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('agents')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-white">
        <h2 className="text-sm font-semibold mr-4">管理面板</h2>
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                activeTab === tab.id
                  ? 'bg-[#f5f5f5] text-[#1a1a1a] font-medium'
                  : 'text-[#888] hover:text-[#555] hover:bg-[#fafafa]',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'agents' && <AgentManageTab />}
        {activeTab === 'users' && <Placeholder label="用户管理" />}
        {activeTab === 'rooms' && <Placeholder label="Room 管理" />}
        {activeTab === 'settings' && <Placeholder label="设置" />}
      </div>
    </div>
  )
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center h-full text-sm text-[#999]">
      {label}（即将推出）
    </div>
  )
}

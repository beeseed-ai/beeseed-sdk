import { useEffect, useState } from 'react'
import { Bot, Users, MessageSquare, Settings } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { AgentManageTab } from './AgentManageTab.js'
import { UserManageTab } from './UserManageTab.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'

const tabs = [
  { id: 'agents', label: 'Agent 模板', icon: Bot },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'channels', label: '频道管理', icon: MessageSquare },
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
        {activeTab === 'users' && <UserManageTab />}
        {activeTab === 'channels' && <Placeholder label="频道管理" />}
        {activeTab === 'settings' && <ChannelPolicySettings />}
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

interface ChannelCreationPolicy {
  mode: 'all_users' | 'admin_only' | 'owner_only' | 'disabled'
  default_agent_ids: string[]
  max_channels_per_user: number
  require_purpose: boolean
  default_channel_type: string
}

function ChannelPolicySettings() {
  const { api } = useBeeSeedContext()
  const [policy, setPolicy] = useState<ChannelCreationPolicy>({
    mode: 'all_users',
    default_agent_ids: ['assistant'],
    max_channels_per_user: 0,
    require_purpose: false,
    default_channel_type: 'create',
  })
  const [agentText, setAgentText] = useState('assistant')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('admin/settings/channels').json<ChannelCreationPolicy>().then((data) => {
      setPolicy(data)
      setAgentText((data.default_agent_ids || []).join(', '))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [api])

  async function save() {
    setSaving(true)
    const next = {
      ...policy,
      default_agent_ids: agentText.split(',').map((item) => item.trim()).filter(Boolean),
      max_channels_per_user: Number(policy.max_channels_per_user) || 0,
      default_channel_type: policy.default_channel_type || 'create',
    }
    try {
      const saved = await api.patch('admin/settings/channels', { json: next }).json<ChannelCreationPolicy>()
      setPolicy(saved)
      setAgentText((saved.default_agent_ids || []).join(', '))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-[#999]">加载中...</div>
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="max-w-2xl space-y-6">
        <div>
          <h3 className="text-sm font-semibold">频道策略</h3>
          <p className="mt-1 text-xs text-[#777]">控制谁可以手动创建频道，以及新频道默认加入哪些 Agent。</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-[#555]">谁可以创建频道</label>
          <select
            value={policy.mode}
            onChange={(e) => setPolicy({ ...policy, mode: e.target.value as ChannelCreationPolicy['mode'] })}
            className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-[#999]"
          >
            <option value="all_users">所有登录用户</option>
            <option value="admin_only">仅管理员</option>
            <option value="owner_only">仅 Owner</option>
            <option value="disabled">关闭手动创建</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-[#555]">默认 Agent</label>
          <Input value={agentText} onChange={(e) => setAgentText(e.target.value)} placeholder="assistant" />
          <div className="text-xs text-[#999]">多个 Agent 用英文逗号分隔。创建频道时会自动加入这些 Agent。</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#555]">每个普通用户最多创建</label>
            <Input
              type="number"
              min={0}
              value={policy.max_channels_per_user}
              onChange={(e) => setPolicy({ ...policy, max_channels_per_user: Number(e.target.value) })}
            />
            <div className="text-xs text-[#999]">0 表示不限制。</div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#555]">默认频道类型</label>
            <Input
              value={policy.default_channel_type}
              onChange={(e) => setPolicy({ ...policy, default_channel_type: e.target.value })}
              placeholder="create"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[#555]">
          <input
            type="checkbox"
            checked={policy.require_purpose}
            onChange={(e) => setPolicy({ ...policy, require_purpose: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          创建频道时必须填写用途
        </label>

        <Button onClick={save} disabled={saving}>
          {saving ? '保存中...' : '保存频道策略'}
        </Button>
      </div>
    </div>
  )
}

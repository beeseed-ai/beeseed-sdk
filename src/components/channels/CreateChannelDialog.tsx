import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useChannels } from '../../hooks/use-channels.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js'
import {
  channelAgentPanelState,
  channelCreationBlockedMessage,
  channelPolicyLoadErrorMessage,
  type AgentOption,
  type ChannelCreationPolicyResponse,
  type ChannelPolicyLoadStatus,
} from './channelPolicyState.js'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateChannelDialog({ open, onOpenChange }: Props) {
  const { api } = useBeeSeedContext()
  const { createChannel, requestJoin } = useChannels()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [joinChannelId, setJoinChannelId] = useState('')
  const [joinSubmitting, setJoinSubmitting] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSubmitted, setJoinSubmitted] = useState(false)
  const [policy, setPolicy] = useState<ChannelCreationPolicyResponse | null>(null)
  const [policyStatus, setPolicyStatus] = useState<ChannelPolicyLoadStatus>('idle')
  const [policyLoadError, setPolicyLoadError] = useState('')
  const [selectedAgentIDs, setSelectedAgentIDs] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const agentOptions = useMemo<AgentOption[]>(() => {
    if (policy?.available_agents?.length) return policy.available_agents
    return (policy?.policy?.default_agent_ids ?? []).map((id): AgentOption => ({ id, role: id }))
  }, [policy])
  const agentPanelState = channelAgentPanelState({
    status: policyStatus,
    policy,
    agentCount: agentOptions.length,
  })

  function loadPolicy() {
    setPolicy(null)
    setPolicyStatus('loading')
    setPolicyLoadError('')
    setSelectedAgentIDs([])
    api.get('channel-creation-policy').json<ChannelCreationPolicyResponse>().then((data) => {
      setPolicy(data)
      setPolicyStatus('loaded')
      setSelectedAgentIDs(data.policy?.default_agent_ids ?? data.available_agents?.map((agent) => agent.id) ?? [])
    }).catch((err: unknown) => {
      setPolicy(null)
      setPolicyStatus('failed')
      setPolicyLoadError(channelPolicyLoadErrorMessage(err))
    })
  }

  useEffect(() => {
    if (!open) return
    setTab('create')
    setError('')
    setJoinError('')
    setJoinSubmitted(false)
    loadPolicy()
  }, [api, open])

  function toggleAgent(agentID: string) {
    setSelectedAgentIDs((current) => (
      current.includes(agentID)
        ? current.filter((id) => id !== agentID)
        : [...current, agentID]
    ))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return
    if (policy?.policy?.require_purpose && !purpose.trim()) {
      setError('请填写频道用途')
      return
    }
    setCreating(true)
    const available = new Set(agentOptions.map((agent) => agent.id))
    const agentIDs = selectedAgentIDs.filter((id) => available.has(id))
    const result = await createChannel({ name: name.trim(), purpose: purpose.trim() || undefined, agent_ids: agentIDs })
    setCreating(false)
    if (result) {
      setName('')
      setPurpose('')
      onOpenChange(false)
    } else {
      setError('创建失败，请检查频道策略或稍后重试')
    }
  }

  async function handleJoinSubmit(e: FormEvent) {
    e.preventDefault()
    const channelId = joinChannelId.trim()
    if (!channelId) return
    setJoinSubmitting(true)
    setJoinError('')
    setJoinSubmitted(false)
    try {
      const result = await requestJoin(channelId)
      if (result.error) {
        setJoinError(result.error)
        return
      }
      setJoinSubmitted(true)
      setJoinChannelId('')
    } finally {
      setJoinSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(560px,calc(100vw-2rem))] sm:max-w-[560px]" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>频道</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as 'create' | 'join')} defaultValue="create" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">新建频道</TabsTrigger>
            <TabsTrigger value="join">加入频道</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">频道名称</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入频道名称"
                  autoFocus={tab === 'create'}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">频道用途{policy?.policy?.require_purpose ? '' : '（可选）'}</label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="这个频道准备用来做什么"
                  className="min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">Agent</label>
                  {agentOptions.length > 0 && (
                    <span className="text-xs text-muted-foreground">已选 {selectedAgentIDs.length}/{agentOptions.length}</span>
                  )}
                </div>
                {agentPanelState === 'loading' ? (
                  <div className="rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">Agent 加载中...</div>
                ) : agentPanelState === 'failed' ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3 text-sm text-destructive">
                    <div>{policyLoadError || '频道策略暂时不可用，请稍后重试或联系管理员。'}</div>
                    <Button variant="outline" type="button" className="mt-3 h-8 border-destructive/30 text-destructive hover:text-destructive" onClick={loadPolicy}>
                      重试
                    </Button>
                  </div>
                ) : (
                  agentPanelState === 'empty' ? (
                    <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">当前 App 暂无可用 Agent</div>
                  ) : (
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                      {agentOptions.map((agent) => {
                        const checked = selectedAgentIDs.includes(agent.id)
                        return (
                          <label
                            key={agent.id}
                            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAgent(agent.id)}
                              className="size-4 rounded border-border accent-primary"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{agent.name || agent.id}</span>
                              <span className="block truncate font-mono text-xs text-muted-foreground">
                                {agent.role || agent.id}{agent.version ? ` · v${String(agent.version).replace(/^v/i, '')}` : ''}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )
                )}
                {policy && agentOptions.length > 0 && selectedAgentIDs.length === 0 && (
                  <div className="text-xs text-destructive">至少选择一个 Agent</div>
                )}
              </div>
              {policy && !policy.can_create && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {channelCreationBlockedMessage(policy.reason)}
                </div>
              )}
              {error && <div className="text-xs text-destructive">{error}</div>}

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button disabled={creating || policyStatus === 'loading' || !policy || !name.trim() || policy.can_create === false || (agentOptions.length > 0 && selectedAgentIDs.length === 0)}>
                  {creating ? '创建中...' : '创建'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="join" className="mt-4">
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">目标频道 ID</label>
                <Input
                  value={joinChannelId}
                  onChange={(event) => { setJoinChannelId(event.target.value); setJoinSubmitted(false); setJoinError('') }}
                  placeholder="输入目标频道 ID"
                  autoFocus={tab === 'join'}
                />
              </div>
              {joinSubmitted && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  申请已发送，等待频道管理员处理。
                </div>
              )}
              {joinError && <div className="text-xs text-destructive">{joinError}</div>}

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button disabled={joinSubmitting || !joinChannelId.trim()}>
                  {joinSubmitting ? '发送中...' : '发送申请'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

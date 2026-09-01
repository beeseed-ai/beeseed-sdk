import { RefreshCw, Save, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'

interface PersonalSkillOption {
  definition_id: string
  skill_key: string
  display_name: string
  version_number: number
  contains_scripts: boolean
}

interface AgentSkillBinding {
  skill_definition_id: string
  status: string
  skill_update_pending: boolean
}

interface AgentSkillsResponse {
  capability_enabled: boolean
  skills: PersonalSkillOption[]
  bindings: AgentSkillBinding[]
}

export interface AgentSkillsPanelProps {
  channelId: string
  agentId: string
  agentName?: string
  onSaved?: () => void
}

export function AgentSkillsPanel({ channelId, agentId, agentName, onSaved }: AgentSkillsPanelProps) {
  const { api } = useBeeSeedContext()
  const [data, setData] = useState<AgentSkillsResponse>({ capability_enabled: true, skills: [], bindings: [] })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`channels/${encodeURIComponent(channelId)}/agents/${encodeURIComponent(agentId)}/skills`).json<AgentSkillsResponse>()
      setData(response)
      setSelected(new Set(response.bindings.filter((binding) => binding.status !== 'deleted').map((binding) => binding.skill_definition_id)))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法加载 Agent Skills')
    } finally {
      setLoading(false)
    }
  }, [agentId, api, channelId])

  useEffect(() => { void refresh() }, [refresh])

  const toggle = (definitionId: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(definitionId)) next.delete(definitionId)
      else next.add(definitionId)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put(`channels/${encodeURIComponent(channelId)}/agents/${encodeURIComponent(agentId)}/skills`, { json: { skill_definition_ids: Array.from(selected) } })
      await refresh()
      onSaved?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Agent Skill 保存失败')
    } finally {
      setSaving(false)
    }
  }

  const pending = new Set(data.bindings.filter((binding) => binding.skill_update_pending).map((binding) => binding.skill_definition_id))
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white text-[#181d26]" aria-labelledby="agent-skills-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dddddd] px-4 py-3">
        <div><h2 id="agent-skills-title" className="text-base font-medium">{agentName || agentId} 的 Skills</h2><p className="mt-1 text-sm text-[#41454d]">只显示你自己的已发布 Skills；保存后将在活动任务结束后自动生效。</p></div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading} aria-label="刷新 Agent Skills"><RefreshCw className={loading ? 'animate-spin' : ''} />刷新</Button>
      </header>

      {error && <p className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

      {!data.capability_enabled ? (
        <div className="m-4 flex items-start gap-3 rounded-md border border-[#dddddd] bg-[#f8fafc] p-4" role="status"><ShieldAlert className="mt-0.5 size-5" /><div><p className="text-sm font-medium">当前 App 未开启个人 Skill</p><p className="mt-1 text-sm text-[#41454d]">已有绑定已保留，重新开启后会自动恢复。</p></div></div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="正在加载 Agent Skills">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-md bg-[#f8fafc]" />)}</div>
          ) : data.skills.length === 0 ? (
            <div className="py-12 text-center" role="status"><p className="text-sm font-medium">没有可启用的个人 Skill</p><p className="mt-1 text-sm text-[#41454d]">请先在“我的 Skills”上传并等待发布完成。</p></div>
          ) : (
            <fieldset className="divide-y divide-[#dddddd] rounded-md border border-[#dddddd]"><legend className="sr-only">选择 Agent Skills</legend>{data.skills.map((skill) => (
              <label key={skill.definition_id} className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3 active:bg-[#f8fafc]">
                <input type="checkbox" className="size-4 accent-[#181d26]" checked={selected.has(skill.definition_id)} onChange={() => toggle(skill.definition_id)} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{skill.display_name}</span><span className="mt-1 block text-xs text-[#41454d]">v{skill.version_number} · {skill.skill_key}</span></span>
                {pending.has(skill.definition_id) && <Badge variant="warning">更新待生效</Badge>}
              </label>
            ))}</fieldset>
          )}
        </div>
      )}

      {data.capability_enabled && <footer className="flex justify-end border-t border-[#dddddd] px-4 py-3"><Button onClick={() => void save()} disabled={loading || saving}><Save />{saving ? '保存中…' : '保存'}</Button></footer>}
    </section>
  )
}

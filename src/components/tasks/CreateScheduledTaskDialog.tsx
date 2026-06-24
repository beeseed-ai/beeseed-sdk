import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AlignLeft, CalendarClock, CalendarPlus, Repeat2, UserRound } from 'lucide-react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'
import type { CreateScheduledTaskInput } from '../../stores/tasks.js'
import type { ChannelMemberInfo } from '../../core/types.js'

interface Props {
  agents?: ChannelMemberInfo[]
  onSubmit: (data: CreateScheduledTaskInput) => void
}

type RecurrencePreset = 'daily_9' | 'weekday_9' | 'weekly_monday_9' | 'monthly_first_9' | 'hourly' | 'custom'

const RECURRENCE_PRESETS: Array<{
  value: RecurrencePreset
  label: string
  description: string
  cron: string
}> = [
  { value: 'daily_9', label: '每天 09:00', description: '每天上午 9 点执行一次', cron: '0 9 * * *' },
  { value: 'weekday_9', label: '工作日 09:00', description: '周一到周五上午 9 点执行', cron: '0 9 * * 1-5' },
  { value: 'weekly_monday_9', label: '每周一 09:00', description: '每周一上午 9 点执行', cron: '0 9 * * 1' },
  { value: 'monthly_first_9', label: '每月 1 日 09:00', description: '每月 1 号上午 9 点执行', cron: '0 9 1 * *' },
  { value: 'hourly', label: '每小时', description: '每个整点执行一次', cron: '0 * * * *' },
  { value: 'custom', label: '自定义 Cron', description: '高级设置，手动填写 Cron 表达式', cron: '' },
]

const defaultRecurrencePreset = RECURRENCE_PRESETS[1]

export function CreateScheduledTaskDialog({ agents = [], onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [runAt, setRunAt] = useState('')
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>(defaultRecurrencePreset.value)
  const [cronExpr, setCronExpr] = useState(defaultRecurrencePreset.cron)
  const [mode, setMode] = useState<'once' | 'recurring'>('once')
  const [assignedAgentId, setAssignedAgentId] = useState('')
  const firstAgentId = agents[0]?.agent_id || ''
  const hasAgents = agents.length > 0
  const selectedPreset = RECURRENCE_PRESETS.find((preset) => preset.value === recurrencePreset) || defaultRecurrencePreset

  useEffect(() => {
    if (open && !assignedAgentId && firstAgentId) {
      setAssignedAgentId(firstAgentId)
    }
  }, [open, assignedAgentId, firstAgentId])

  const handleSubmit = () => {
    if (!title.trim()) return
    if (mode === 'once' && !runAt.trim()) return
    if (mode === 'recurring' && !cronExpr.trim()) return
    if (!assignedAgentId) return
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      assigned_agent_id: assignedAgentId || undefined,
      run_at: runAt ? new Date(runAt).toISOString() : undefined,
      cron_expr: mode === 'recurring' ? cronExpr.trim() : undefined,
      timezone: 'Asia/Shanghai',
      overlap_policy: 'skip',
      catch_up_policy: 'latest',
    })
    setTitle('')
    setDescription('')
    setRunAt('')
    setRecurrencePreset(defaultRecurrencePreset.value)
    setCronExpr(defaultRecurrencePreset.cron)
    setAssignedAgentId('')
    setMode('once')
    setOpen(false)
  }

  const switchMode = (nextMode: 'once' | 'recurring') => {
    setMode(nextMode)
    if (nextMode === 'recurring' && !cronExpr.trim()) {
      setRecurrencePreset(defaultRecurrencePreset.value)
      setCronExpr(defaultRecurrencePreset.cron)
    }
  }

  const updateRecurrencePreset = (value: RecurrencePreset) => {
    setRecurrencePreset(value)
    const preset = RECURRENCE_PRESETS.find((item) => item.value === value)
    if (preset && value !== 'custom') {
      setCronExpr(preset.cron)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="计划任务">
        <CalendarPlus className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent className="w-[min(100vw-2rem,760px)] p-0" onClose={() => setOpen(false)}>
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle>自动任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-[#f3f6f9] p-1">
              <button
                type="button"
                onClick={() => switchMode('once')}
                className={mode === 'once' ? 'rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#172033] shadow-sm' : 'rounded-md px-3 py-2 text-sm font-semibold text-[#465267] hover:bg-white/65'}
              >
                一次
              </button>
              <button
                type="button"
                onClick={() => switchMode('recurring')}
                className={mode === 'recurring' ? 'rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#172033] shadow-sm' : 'rounded-md px-3 py-2 text-sm font-semibold text-[#465267] hover:bg-white/65'}
              >
                重复
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel label="标题" />
                <Input placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              </div>

              <div>
                <FieldLabel label="执行人" icon={<UserRound className="w-3.5 h-3.5" />} />
                <select
                  value={assignedAgentId}
                  onChange={(e) => setAssignedAgentId(e.target.value)}
                  disabled={!hasAgents}
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {!hasAgents && <option value="">无可用 Agent</option>}
                  {agents.map((agent) => (
                    <option key={agent.agent_id || agent.id} value={agent.agent_id || ''}>
                      {agent.display_name || agent.agent_id}
                    </option>
                  ))}
                </select>
                {!hasAgents && (
                  <div className="mt-1.5 text-xs text-destructive">当前频道没有 Agent，无法创建自动任务。</div>
                )}
              </div>
            </div>

            {mode === 'once' ? (
              <div>
                <FieldLabel label="执行时间" icon={<CalendarClock className="w-3.5 h-3.5" />} />
                <Input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-[#fbfcfd] p-3">
                <FieldLabel label="重复周期" icon={<Repeat2 className="w-3.5 h-3.5" />} />
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                  <select
                    value={recurrencePreset}
                    onChange={(e) => updateRecurrencePreset(e.target.value as RecurrencePreset)}
                    className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm font-medium text-[#172033] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {RECURRENCE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                  <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {selectedPreset.description}
                    {recurrencePreset !== 'custom' && <span className="ml-2 font-mono text-[#465267]">{selectedPreset.cron}</span>}
                  </div>
                </div>
                {recurrencePreset === 'custom' && (
                  <div className="mt-3">
                    <FieldLabel label="Cron 表达式" />
                    <Input placeholder="例如：0 9 * * 1-5" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
                    <div className="mt-1.5 text-xs text-muted-foreground">格式：分钟 小时 日期 月份 星期，例如工作日 9 点为 0 9 * * 1-5。</div>
                  </div>
                )}
              </div>
            )}

            <div>
              <FieldLabel label="描述" icon={<AlignLeft className="w-3.5 h-3.5" />} />
              <textarea
                placeholder="描述（可选）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-b-xl px-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!hasAgents || !assignedAgentId || !title.trim() || (mode === 'once' ? !runAt.trim() : !cronExpr.trim())}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FieldLabel({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  )
}

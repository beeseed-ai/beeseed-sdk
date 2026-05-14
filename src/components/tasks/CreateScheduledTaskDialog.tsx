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

export function CreateScheduledTaskDialog({ agents = [], onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [runAt, setRunAt] = useState('')
  const [cronExpr, setCronExpr] = useState('')
  const [mode, setMode] = useState<'once' | 'recurring'>('once')
  const [assignedAgentId, setAssignedAgentId] = useState('')
  const firstAgentId = agents[0]?.agent_id || ''
  const hasAgents = agents.length > 0

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
    setCronExpr('')
    setAssignedAgentId('')
    setMode('once')
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="计划任务">
        <CalendarPlus className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent className="p-0 sm:max-w-md" onClose={() => setOpen(false)}>
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle>自动任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-4 py-4">
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode('once')}
                className={mode === 'once' ? 'rounded bg-background px-3 py-1.5 text-sm shadow-sm' : 'rounded px-3 py-1.5 text-sm text-muted-foreground'}
              >
                一次
              </button>
              <button
                type="button"
                onClick={() => setMode('recurring')}
                className={mode === 'recurring' ? 'rounded bg-background px-3 py-1.5 text-sm shadow-sm' : 'rounded px-3 py-1.5 text-sm text-muted-foreground'}
              >
                重复
              </button>
            </div>
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

            {mode === 'once' ? (
              <div>
                <FieldLabel label="执行时间" icon={<CalendarClock className="w-3.5 h-3.5" />} />
                <Input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
              </div>
            ) : (
              <div>
                <FieldLabel label="Cron" icon={<Repeat2 className="w-3.5 h-3.5" />} />
                <Input placeholder="0 9 * * 1-5" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
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

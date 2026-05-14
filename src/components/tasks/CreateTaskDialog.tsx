import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AlignLeft, CalendarDays, Flag, Plus, UserRound } from 'lucide-react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'
import type { ChannelMemberInfo } from '../../core/types.js'

interface Props {
  agents?: ChannelMemberInfo[]
  onSubmit: (data: { title: string; description?: string; priority?: number; due_at?: string; assigned_type?: 'agent'; assigned_agent_id?: string }) => void
  requestOpenKey?: number
}

export function CreateTaskDialog({ agents = [], onSubmit, requestOpenKey }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState('3')
  const [assignedAgentId, setAssignedAgentId] = useState('')

  useEffect(() => {
    if (requestOpenKey && requestOpenKey > 0) {
      setOpen(true)
    }
  }, [requestOpenKey])

  const handleSubmit = () => {
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority: Number(priority),
      due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      assigned_type: assignedAgentId ? 'agent' : undefined,
      assigned_agent_id: assignedAgentId || undefined,
    })
    setTitle('')
    setDescription('')
    setDueAt('')
    setPriority('3')
    setAssignedAgentId('')
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="新建任务">
        <Plus className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent className="p-0 sm:max-w-md" onClose={() => setOpen(false)}>
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle>创建任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div>
              <FieldLabel label="标题" />
              <Input placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel label="执行人" icon={<UserRound className="w-3.5 h-3.5" />} />
                <select
                  value={assignedAgentId}
                  onChange={(e) => setAssignedAgentId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">未指定</option>
                  {agents.map((agent) => (
                    <option key={agent.agent_id || agent.id} value={agent.agent_id || ''}>
                      {agent.display_name || agent.agent_id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel label="优先级" icon={<Flag className="w-3.5 h-3.5" />} />
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="5">高</option>
                  <option value="3">普通</option>
                  <option value="1">低</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel label="截止时间" icon={<CalendarDays className="w-3.5 h-3.5" />} />
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>

            <div>
              <FieldLabel label="描述" icon={<AlignLeft className="w-3.5 h-3.5" />} />
              <textarea
                placeholder="描述（可选）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-b-xl px-5">
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!title.trim()}>创建</Button>
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

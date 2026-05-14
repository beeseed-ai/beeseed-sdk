import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'
import type { CreateScheduledTaskInput } from '../../stores/tasks.js'

interface Props {
  onSubmit: (data: CreateScheduledTaskInput) => void
}

export function CreateScheduledTaskDialog({ onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [runAt, setRunAt] = useState('')
  const [cronExpr, setCronExpr] = useState('')
  const [mode, setMode] = useState<'once' | 'recurring'>('once')

  const handleSubmit = () => {
    if (!title.trim()) return
    if (mode === 'once' && !runAt.trim()) return
    if (mode === 'recurring' && !cronExpr.trim()) return
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
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
    setMode('once')
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="计划任务">
        <CalendarPlus className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <div className="w-[360px] rounded-lg bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-lg">
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle>计划任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-4">
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
            <Input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <textarea
              placeholder="描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
            {mode === 'once' ? (
              <Input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
            ) : (
              <Input placeholder="0 9 * * 1-5" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!title.trim() || (mode === 'once' ? !runAt.trim() : !cronExpr.trim())}>创建</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  )
}

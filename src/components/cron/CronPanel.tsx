import { Clock, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { useState } from 'react'
import { useCron } from '../../hooks/use-cron.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'

export function CronPanel({ roomId }: { roomId: string | null }) {
  const { jobs, loading, createJob, updateJob, deleteJob } = useCron(roomId)
  const [createOpen, setCreateOpen] = useState(false)
  const [cronExpr, setCronExpr] = useState('0 9 * * *')
  const [message, setMessage] = useState('')

  if (!roomId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">选择一个对话管理定时任务</div>
  }

  const handleCreate = () => {
    if (!cronExpr.trim() || !message.trim()) return
    void createJob({ cron_expr: cronExpr.trim(), message: message.trim(), timezone: 'Asia/Shanghai' })
    setCronExpr('0 9 * * *')
    setMessage('')
    setCreateOpen(false)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">定时任务</h2>
        <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">暂无定时任务</div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-start gap-3 p-3 rounded-lg border border-border group hover:bg-muted/30 transition-colors">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{job.message}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{job.cron_expr}</code>
                    <Badge variant={job.enabled ? 'success' : 'outline'} className="text-[10px]">
                      {job.enabled ? '启用' : '停用'}
                    </Badge>
                    {job.last_run && (
                      <span className="text-[10px] text-muted-foreground">
                        上次: {new Date(job.last_run).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateJob(job.id, { enabled: !job.enabled })}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    {job.enabled ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <button onClick={() => deleteJob(job.id)} className="hidden group-hover:block p-1 rounded hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={() => setCreateOpen(false)}>
        <DialogHeader><DialogTitle>创建定时任务</DialogTitle></DialogHeader>
        <div className="space-y-3 p-4">
          <Input placeholder="Cron 表达式 (如 0 9 * * *)" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
          <textarea
            placeholder="触发时发送的消息"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button>
          <Button onClick={handleCreate} disabled={!cronExpr.trim() || !message.trim()}>创建</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

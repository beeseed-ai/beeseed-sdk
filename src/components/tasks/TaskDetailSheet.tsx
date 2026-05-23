import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MessageSquare, RotateCcw, Save, X } from 'lucide-react'
import type { ChannelMemberInfo, Task, TaskComment } from '../../core/types.js'
import { useTasks } from '../../hooks/use-tasks.js'
import { Button } from '../ui/button.js'
import { Badge } from '../ui/badge.js'
import { Sheet, SheetContent, SheetHeader } from '../ui/sheet.js'

interface Props {
  channelId: string | null
  task: Task | null
  members: ChannelMemberInfo[]
  channelName?: string
  open: boolean
  onClose: () => void
  onTaskChanged?: () => void
}

const STATUS_LABEL: Record<Task['status'], string> = {
  pending: '待处理',
  in_progress: '进行中',
  done: '已完成',
  failed: '失败',
  blocked: '阻塞',
}

export function TaskDetailSheet({ channelId, task, members, channelName, open, onClose, onTaskChanged }: Props) {
  const { updateTask, getComments, addComment } = useTasks(channelId)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [dueAtDraft, setDueAtDraft] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)

  const agents = useMemo(
    () => members.filter((member) => member.member_type === 'agent' && member.agent_id),
    [members],
  )

  useEffect(() => {
    if (!open || !task) {
      setComments([])
      setCommentText('')
      return
    }
    setCommentsLoading(true)
    void getComments(task.id)
      .then(setComments)
      .finally(() => setCommentsLoading(false))
  }, [open, task?.id])

  useEffect(() => {
    if (!task) return
    setTitleDraft(task.title)
    setDescriptionDraft(task.description || '')
    setDueAtDraft(toDateTimeLocal(task.due_at))
  }, [task?.id])

  if (!task) {
    return null
  }

  const awaitingVerification = task.verification_status === 'pending' || task.scheduler_state === 'awaiting_verify'
  const waitingAssignment = task.status === 'pending' && task.scheduler_state === 'manual' && !task.assigned_agent_id
  const statusBadge = awaitingVerification
    ? { label: '待验收', variant: 'warning' as const }
    : waitingAssignment
      ? { label: '待分配', variant: 'outline' as const }
    : {
        label: STATUS_LABEL[task.status],
        variant: (task.status === 'done' ? 'success' : task.status === 'failed' ? 'destructive' : task.status === 'blocked' ? 'warning' : task.status === 'pending' ? 'outline' : 'default') as 'outline' | 'default' | 'success' | 'destructive' | 'warning',
      }

  async function submitComment() {
    const content = commentText.trim()
    if (!content || !task) return
    const created = await addComment(task.id, content)
    if (created) {
      setComments((items) => [...items, created])
      setCommentText('')
    }
  }

  async function saveDetails() {
    const title = titleDraft.trim()
    if (!title || !task) return
    setSavingDetails(true)
    try {
      await updateTask(task.id, {
        title,
        description: descriptionDraft,
        due_at: dueAtDraft ? new Date(dueAtDraft).toISOString() : null,
      })
      onTaskChanged?.()
    } finally {
      setSavingDetails(false)
    }
  }

  async function acceptTask() {
    if (!task) return
    await updateTask(task.id, { verification_status: 'accepted' })
    onTaskChanged?.()
  }

  async function rejectTask() {
    if (!task) return
    await updateTask(task.id, { verification_status: 'rejected' })
    onTaskChanged?.()
  }

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-[440px]">
      <SheetHeader>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{task.title}</div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={statusBadge.variant} className="text-[10px]">
              {statusBadge.label}
            </Badge>
            {task.scheduler_state && (
              <span className="text-[10px] text-muted-foreground">{task.scheduler_state}</span>
            )}
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} title="关闭">
          <X className="w-4 h-4" />
        </Button>
      </SheetHeader>

      <SheetContent className="px-4 py-4">
        <div className="space-y-5">
          {awaitingVerification && (
            <section className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
              <div className="text-sm font-medium text-amber-950">Agent 已回报完成，等待验收</div>
              {task.result && <div className="mt-1 whitespace-pre-wrap text-sm text-amber-950/80">{task.result}</div>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={acceptTask}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  验收通过
                </Button>
                <Button size="sm" variant="outline" onClick={rejectTask}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  退回重做
                </Button>
              </div>
            </section>
          )}
          {waitingAssignment && (
            <section className="rounded-md border border-border bg-muted/40 px-3 py-3">
              <div className="text-sm font-medium text-foreground">任务尚未分配执行人</div>
              <div className="mt-1 text-sm leading-5 text-muted-foreground">分配给频道内 Agent 后，任务才会进入调度执行。</div>
            </section>
          )}

          <section className="space-y-3">
            <div className="grid grid-cols-[72px_1fr] items-center gap-2">
              <label className="text-xs text-muted-foreground">标题</label>
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="grid grid-cols-[72px_1fr] items-center gap-2">
              <label className="text-xs text-muted-foreground">状态</label>
              <select
                value={task.status}
                onChange={(event) => {
                  void updateTask(task.id, { status: event.target.value as Task['status'] }).then(onTaskChanged)
                }}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="pending">待处理</option>
                <option value="in_progress">进行中</option>
                <option value="done">已完成</option>
                <option value="failed">失败</option>
                <option value="blocked">阻塞</option>
              </select>
            </div>

            <div className="grid grid-cols-[72px_1fr] items-center gap-2">
              <label className="text-xs text-muted-foreground">执行人</label>
              <select
                value={task.assigned_agent_id || ''}
                onChange={(event) => {
                  void updateTask(task.id, {
                    assigned_agent_id: event.target.value || undefined,
                    assigned_type: event.target.value ? 'agent' : undefined,
                  }).then(onTaskChanged)
                }}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">未指定</option>
                {agents.map((agent) => (
                  <option key={agent.agent_id || agent.id} value={agent.agent_id || ''}>
                    {agent.display_name || agent.agent_id}
                  </option>
                ))}
              </select>
            </div>

            <ReadOnlyRow label="频道" value={channelName || task.channel_id || ''} />
            <ReadOnlyRow label="创建时间" value={formatDateTime(task.created_at)} />
            <div className="grid grid-cols-[72px_1fr] items-center gap-2">
              <label className="text-xs text-muted-foreground">截止时间</label>
              <input
                type="datetime-local"
                value={dueAtDraft}
                onChange={(event) => setDueAtDraft(event.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            {task.scheduled_start_at && <ReadOnlyRow label="计划开始" value={formatDateTime(task.scheduled_start_at)} />}
            {task.agent_completed_at && <ReadOnlyRow label="Agent完成" value={formatDateTime(task.agent_completed_at)} />}
            {task.verified_at && <ReadOnlyRow label="验收时间" value={formatDateTime(task.verified_at)} />}
            {task.failure_code && <ReadOnlyRow label="失败类型" value={task.failure_code} />}
          </section>

          <section>
            <div className="mb-2 text-xs font-medium text-muted-foreground">描述</div>
            <textarea
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              rows={4}
              placeholder="描述（可选）"
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={saveDetails} disabled={!titleDraft.trim() || savingDetails}>
                <Save className="mr-1.5 w-3.5 h-3.5" />
                保存
              </Button>
            </div>
          </section>

          {task.result && (
            <section>
              <div className="mb-2 text-xs font-medium text-muted-foreground">结果</div>
              <div className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm">{task.result}</div>
            </section>
          )}

          {task.failure_detail && (
            <section>
              <div className="mb-2 text-xs font-medium text-muted-foreground">失败详情</div>
              <div className="whitespace-pre-wrap rounded-md bg-destructive/5 px-3 py-2 text-sm text-destructive">{task.failure_detail}</div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" />
              评论
            </div>
            {commentsLoading ? (
              <div className="py-3 text-sm text-muted-foreground">加载中...</div>
            ) : comments.length === 0 ? (
              <div className="py-3 text-sm text-muted-foreground">暂无评论</div>
            ) : (
              <div className="space-y-2">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-md border border-border px-3 py-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{comment.author_type}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(comment.created_at)}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{comment.content}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-2">
              <textarea
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                rows={3}
                placeholder="添加评论"
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={submitComment} disabled={!commentText.trim()}>发送</Button>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-sm">{value}</div>
    </div>
  )
}

function formatDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toDateTimeLocal(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

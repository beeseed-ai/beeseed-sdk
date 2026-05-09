import { Plus, Search, Upload, ChevronDown, ChevronRight, FileText, Users, ListChecks, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import type { RoomMemberInfo, Task, StorageObject } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { formatBytes, formatTime } from '../../lib/format.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar.js'

interface Props {
  roomId: string | null
  members?: RoomMemberInfo[]
  tasks?: Task[]
  files?: StorageObject[]
  onCreateTask?: () => void
  className?: string
}

export function DetailPanel({ roomId, members = [], tasks = [], files = [], onCreateTask, className }: Props) {
  const { panelVisible } = useDetailPanel()
  const [tasksOpen, setTasksOpen] = useState(true)
  const [filesOpen, setFilesOpen] = useState(true)
  const [membersOpen, setMembersOpen] = useState(true)

  if (!panelVisible || !roomId) return null

  const agents = members.filter((m) => m.member_type === 'agent')
  const users = members.filter((m) => m.member_type === 'user')

  return (
    <div className={cn('w-[300px] shrink-0 border-l border-border bg-background flex flex-col overflow-hidden', className)}>
      <div className="flex-1 overflow-y-auto">
        {/* Tasks */}
        <div className="border-b border-border">
          <button onClick={() => setTasksOpen(!tasksOpen)} className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors">
            <ListChecks className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-left">任务</span>
            {tasksOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {tasksOpen && (
            <div className="px-4 pb-3">
              <button onClick={onCreateTask} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
                <Plus className="w-3 h-3" /> 新建
              </button>
              {tasks.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 py-2">暂无任务</div>
              ) : (
                <div className="space-y-1">
                  {tasks.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs py-1">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', t.status === 'done' ? 'bg-green-500' : t.status === 'in_progress' ? 'bg-blue-500' : 'bg-muted-foreground/30')} />
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Files */}
        <div className="border-b border-border">
          <button onClick={() => setFilesOpen(!filesOpen)} className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-left">群文件</span>
            {filesOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {filesOpen && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-primary cursor-pointer hover:underline">云盘</span>
                <span className="text-[10px] text-muted-foreground">/</span>
                <span className="text-[10px] text-muted-foreground">当前对话</span>
                <div className="flex-1" />
                <Search className="w-3 h-3 text-muted-foreground cursor-pointer" />
                <Upload className="w-3 h-3 text-muted-foreground cursor-pointer" />
              </div>
              {files.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 py-2">暂无文件</div>
              ) : (
                <div className="space-y-1.5">
                  {files.slice(0, 5).map((f) => (
                    <div key={f.key} className="flex items-start gap-2 py-1 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1 transition-colors">
                      <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs truncate">{f.key.split('/').pop()}</div>
                        <div className="text-[10px] text-muted-foreground">{formatBytes(f.size)} · {formatTime(f.last_modified)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div>
          <button onClick={() => setMembersOpen(!membersOpen)} className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-left">成员</span>
            {membersOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {membersOpen && (
            <div className="px-4 pb-3">
              {agents.length > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">AGENT — {agents.length}</div>
                  <div className="space-y-2 mb-3">
                    {agents.map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5">
                        <Avatar className="size-7 shrink-0">
                          {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                          <AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700">🤖</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{m.display_name}</div>
                          {m.chinese_name && m.chinese_name !== m.display_name && (
                            <div className="text-[10px] text-muted-foreground">{m.chinese_name}</div>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">{m.role}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {users.length > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">用户 — {users.length}</div>
                  <div className="space-y-2">
                    {users.map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5">
                        <Avatar className="size-7 shrink-0">
                          {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : null}
                          <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">{m.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{m.display_name}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">{m.role === 'owner' ? '拥有者' : m.role}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {members.length === 0 && <div className="text-xs text-muted-foreground/60 py-2">暂无成员数据</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

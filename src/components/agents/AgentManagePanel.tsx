import { Bot, Trash2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useAgents } from '../../hooks/use-agents.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'

export function AgentManagePanel() {
  const { agents, loading, createAgent, deleteAgent } = useAgents()
  const [createOpen, setCreateOpen] = useState(false)
  const [newId, setNewId] = useState('')

  const handleCreate = () => {
    if (!newId.trim()) return
    void createAgent({ id: newId.trim() })
    setNewId('')
    setCreateOpen(false)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Agent 管理</h2>
        <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
        ) : agents.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">暂无 Agent</div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg border border-border group hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{agent.display_name || agent.id}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono">{agent.model}</span>
                    <Badge variant={agent.status === 'online' ? 'success' : 'outline'} className="text-[10px]">
                      {agent.status || 'unknown'}
                    </Badge>
                  </div>
                </div>
                <button className="hidden group-hover:block p-1 rounded hover:bg-destructive/10" onClick={() => deleteAgent(agent.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={() => setCreateOpen(false)}>
        <DialogHeader><DialogTitle>创建 Agent</DialogTitle></DialogHeader>
        <div className="p-4">
          <Input placeholder="Agent ID" value={newId} onChange={(e) => setNewId(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button>
          <Button onClick={handleCreate} disabled={!newId.trim()}>创建</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

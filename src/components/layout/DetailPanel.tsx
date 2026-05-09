import { cn } from '../../lib/cn.js'
import { X } from 'lucide-react'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { AccordionSection } from './AccordionSection.js'

interface Props {
  roomId: string | null
  membersContent?: React.ReactNode
  tasksContent?: React.ReactNode
  storageContent?: React.ReactNode
  className?: string
}

export function DetailPanel({ roomId, membersContent, tasksContent, storageContent, className }: Props) {
  const { panelVisible, sections, toggleSection, setPanel } = useDetailPanel()

  if (!panelVisible || !roomId) return null

  return (
    <div className={cn('w-[320px] shrink-0 border-l border-border bg-background flex flex-col', className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">详情</span>
        <button onClick={() => setPanel(false)} className="p-1 rounded hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AccordionSection title="成员" open={sections.members} onToggle={() => toggleSection('members')}>
          {membersContent ?? <div className="text-xs text-muted-foreground py-2">暂无成员数据</div>}
        </AccordionSection>
        <AccordionSection title="任务" open={sections.tasks} onToggle={() => toggleSection('tasks')}>
          {tasksContent ?? <div className="text-xs text-muted-foreground py-2">暂无任务</div>}
        </AccordionSection>
        <AccordionSection title="文件" open={sections.storage} onToggle={() => toggleSection('storage')}>
          {storageContent ?? <div className="text-xs text-muted-foreground py-2">暂无文件</div>}
        </AccordionSection>
      </div>
    </div>
  )
}

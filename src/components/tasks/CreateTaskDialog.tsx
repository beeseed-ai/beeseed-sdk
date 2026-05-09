import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'

interface Props {
  onSubmit: (data: { title: string; description?: string; priority?: number }) => void
}

export function CreateTaskDialog({ onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = () => {
    if (!title.trim()) return
    onSubmit({ title: title.trim(), description: description.trim() || undefined, priority: 3 })
    setTitle('')
    setDescription('')
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogHeader><DialogTitle>创建任务</DialogTitle></DialogHeader>
        <div className="space-y-3 p-4">
          <Input placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <textarea
            placeholder="描述（可选）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>创建</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

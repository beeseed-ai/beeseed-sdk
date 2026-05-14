import { useEffect, useState, type FormEvent } from 'react'
import { useChannels } from '../../hooks/use-channels.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateChannelDialog({ open, onOpenChange }: Props) {
  const { api } = useBeeSeedContext()
  const { createChannel } = useChannels()
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [policy, setPolicy] = useState<{ can_create: boolean; reason?: string; policy?: { require_purpose?: boolean; default_agent_ids?: string[] } } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    api.get('channel-creation-policy').json<typeof policy>().then(setPolicy).catch(() => setPolicy(null))
  }, [api, open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return
    if (policy?.policy?.require_purpose && !purpose.trim()) {
      setError('请填写频道用途')
      return
    }
    setLoading(true)
    const result = await createChannel({ name: name.trim(), purpose: purpose.trim() || undefined })
    setLoading(false)
    if (result) {
      setName('')
      setPurpose('')
      onOpenChange(false)
    } else {
      setError('创建失败，请检查频道策略或稍后重试')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>新建频道</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">频道名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入频道名称"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">频道用途{policy?.policy?.require_purpose ? '' : '（可选）'}</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="这个频道准备用来做什么"
              className="min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            默认 Agent：{policy?.policy?.default_agent_ids?.join('、') || 'assistant'}
          </div>
          {policy && !policy.can_create && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              当前账号不能创建频道：{policy.reason || '频道创建已关闭'}
            </div>
          )}
          {error && <div className="text-xs text-destructive">{error}</div>}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button disabled={loading || !name.trim() || policy?.can_create === false}>
              {loading ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

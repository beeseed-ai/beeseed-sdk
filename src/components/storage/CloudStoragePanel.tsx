import { useRef } from 'react'
import { AlertCircle, Download, File, FolderOpen, MessageSquareQuote, Search, Trash2, Upload, X } from 'lucide-react'
import { useStorage } from '../../hooks/use-storage.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { formatBytes } from '../../lib/format.js'
import { storageRefFromKey } from '../../lib/storage-ref.js'
import { Input } from '../ui/input.js'
import { Button } from '../ui/button.js'

interface Props {
  roomId: string | null
}

export function CloudStoragePanel({ roomId }: Props) {
  const { insertIntoComposer, setActiveFeature, setPanel } = useDetailPanel()
  const {
    objects,
    directories,
    currentPrefix,
    loading,
    uploading,
    uploadProgress,
    uploadError,
    policy,
    usage,
    canUpload,
    searchQuery,
    breadcrumbs,
    browse,
    uploadFile,
    downloadFile,
    deleteFile,
    clearUploadError,
    setSearchQuery,
  } = useStorage(roomId)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!roomId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">选择一个对话查看文件</div>
  }

  async function handleUpload(file: File | undefined) {
    if (!file || !canUpload) return
    try {
      await uploadFile(file, currentPrefix)
    } catch {
      // The store owns the visible upload error state.
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(key: string) {
    const url = await downloadFile(key)
    if (url) window.open(url, '_blank')
  }

  function handleReference(key: string) {
    insertIntoComposer(storageRefFromKey(key))
    setActiveFeature('chat')
    setPanel(true)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold">文件存储</h2>
          <div className="text-[11px] text-muted-foreground">
            {policy.visibility === 'shared' ? '共享空间' : '个人空间'} · {directories.length + objects.length > 0 ? `${directories.length} 个文件夹 · ${objects.length} 个文件` : '当前目录'} · 已用 {formatBytes(usage.bytes)}
          </div>
        </div>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={uploading || !canUpload} onClick={() => fileRef.current?.click()}>
          <Upload className="w-3.5 h-3.5 mr-1" />
          {uploading ? '上传中' : canUpload ? '上传' : '只读'}
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => void handleUpload(e.target.files?.[0])} />
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-4 py-1.5 text-xs text-muted-foreground border-b border-border">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>/</span>}
            <button onClick={() => browse(crumb.prefix)} className="hover:text-foreground transition-colors">
              {crumb.label}
            </button>
          </span>
        ))}
      </div>

      {(uploading || uploadError) && (
        <div className="border-b border-border px-4 py-2">
          {uploading ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">正在上传</span>
                <span className="text-muted-foreground">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{uploadError}</span>
              <button className="rounded p-0.5 hover:bg-destructive/10" onClick={clearUploadError} aria-label="关闭错误">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
        ) : directories.length === 0 && objects.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40">
              <File className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">当前目录暂无文件</div>
              <div className="mt-1 text-xs text-muted-foreground">当前目录是空的。</div>
            </div>
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs" disabled={uploading || !canUpload} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-3.5 w-3.5" />
              {canUpload ? '上传文件' : '只读空间'}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {directories.map((dir) => (
              <button
                key={dir}
                onClick={() => browse(dir)}
                className="flex items-center gap-3 px-4 py-2 w-full hover:bg-muted/50 transition-colors"
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span className="text-sm">{dir.replace(/\/$/, '').split('/').pop()}</span>
              </button>
            ))}
            {objects.map((obj) => (
              <div key={obj.key} className="flex items-center gap-3 px-4 py-2 group">
                <File className="w-4 h-4 text-blue-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{obj.name || obj.key.split('/').pop()}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatBytes(obj.size)} · {new Date(obj.last_modified).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <button
                  title="引用到聊天"
                  onClick={() => handleReference(obj.key)}
                  className="hidden group-hover:block p-1 rounded hover:bg-muted transition-colors"
                >
                  <MessageSquareQuote className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  title="下载"
                  onClick={() => void handleDownload(obj.key)}
                  className="hidden group-hover:block p-1 rounded hover:bg-muted transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  title="删除"
                  onClick={() => deleteFile(obj.key)}
                  className="hidden group-hover:block p-1 rounded hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { FolderOpen, File, Trash2, Search } from 'lucide-react'
import { useStorage } from '../../hooks/use-storage.js'
import { formatBytes } from '../../lib/format.js'
import { Input } from '../ui/input.js'

interface Props {
  roomId: string | null
}

export function CloudStoragePanel({ roomId }: Props) {
  const { objects, directories, loading, searchQuery, breadcrumbs, browse, deleteFile, setSearchQuery } = useStorage(roomId)

  if (!roomId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">选择一个对话查看文件</div>
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">文件存储</h2>
        <div className="flex-1" />
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

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
        ) : directories.length === 0 && objects.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">暂无文件</div>
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
                  <div className="text-sm truncate">{obj.key.split('/').pop()}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatBytes(obj.size)} · {new Date(obj.last_modified).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <button
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

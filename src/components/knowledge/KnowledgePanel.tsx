import { Search, FileText, Trash2, Loader2 } from 'lucide-react'
import { useKnowledge } from '../../hooks/use-knowledge.js'
import { formatBytes } from '../../lib/format.js'
import { Input } from '../ui/input.js'
import { Badge } from '../ui/badge.js'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs.js'

export function KnowledgePanel() {
  const { sources, loading, searchQuery, searchResults, searching, search, deleteSource, setSearchQuery } = useKnowledge()

  const handleSearch = () => {
    if (searchQuery.trim()) void search(searchQuery.trim())
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">知识库</h2>
      </div>

      <Tabs defaultValue="sources" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2">
          <TabsList>
            <TabsTrigger value="sources">来源</TabsTrigger>
            <TabsTrigger value="search">搜索</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="sources" className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
          ) : sources.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">暂无知识来源</div>
          ) : (
            <div className="space-y-2">
              {sources.map((s) => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border border-border group hover:bg-muted/30 transition-colors">
                  <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.title}</div>
                    {s.summary && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.summary}</div>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={s.status === 'ready' ? 'success' : s.status === 'error' ? 'destructive' : 'outline'} className="text-[10px]">
                        {s.status === 'ready' ? '就绪' : s.status === 'processing' ? '处理中' : s.status === 'error' ? '错误' : '等待中'}
                      </Badge>
                      {s.chunk_count > 0 && <span className="text-[10px] text-muted-foreground">{s.chunk_count} 分片</span>}
                      {s.file_size > 0 && <span className="text-[10px] text-muted-foreground">{formatBytes(s.file_size)}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSource(s.id)}
                    className="hidden group-hover:block p-1 rounded hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="flex-1 overflow-y-auto px-4 py-2">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索知识库..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-8"
              />
            </div>
          </div>

          {searching ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              搜索中...
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((r) => (
                <div key={r.chunk_id} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{r.source_title}</span>
                    <span className="text-[10px] text-muted-foreground">相似度 {(r.similarity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{r.content}</div>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="text-center text-sm text-muted-foreground py-8">未找到相关内容</div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">输入关键词搜索知识库</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

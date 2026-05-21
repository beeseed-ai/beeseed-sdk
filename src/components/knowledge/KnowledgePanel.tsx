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
    <div className="flex h-full overflow-hidden bg-[#fafafa]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-4 p-4 sm:space-y-6 sm:p-8">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a1a]">知识库</h1>
            <p className="mt-1 text-sm text-muted-foreground">管理知识来源并检索已索引内容。</p>
          </div>

          <Tabs defaultValue="sources" className="flex max-h-[calc(100dvh-10rem)] min-h-[320px] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="shrink-0 border-b border-border px-3 py-3 sm:px-5 sm:py-4">
              <TabsList>
                <TabsTrigger value="sources">来源</TabsTrigger>
                <TabsTrigger value="search">搜索</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="sources" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
          ) : sources.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">暂无知识来源</div>
          ) : (
            <div className="space-y-2">
              {sources.map((s) => (
                <div key={s.id} className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#181d26]" />
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

            <TabsContent value="search" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
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
      </div>
    </div>
  )
}

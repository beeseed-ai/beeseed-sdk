import { FolderUp, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { userSkillDirectoryRelativePaths } from '../../lib/user-skill-directory.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'

interface PersonalSkillVersion {
  id: string
  skill_key: string
  display_name: string
  version_number: number
  status: string
  contains_scripts: boolean
  review_note?: string
  publish_last_error?: string
  created_at: string
}

interface PersonalSkillsResponse {
  capability_enabled: boolean
  skills: PersonalSkillVersion[]
}

const statusLabels: Record<string, string> = {
  pending_review: '待审核（不可运行）',
  ready_to_publish: '安全校验通过，待发布',
  publishing: '发布中',
  active: '可用',
  rejected: '审核驳回',
  publish_failed: '发布失败',
  superseded: '历史版本',
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'active') return 'success'
  if (status === 'pending_review' || status === 'ready_to_publish' || status === 'publishing') return 'warning'
  if (status === 'rejected' || status === 'publish_failed') return 'destructive'
  return 'outline'
}

export function PersonalSkillsPanel() {
  const { api } = useBeeSeedContext()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [data, setData] = useState<PersonalSkillsResponse>({ capability_enabled: true, skills: [] })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api.get('user-skills').json<PersonalSkillsResponse>())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法加载个人 Skills')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { void refresh() }, [refresh])

  const selectDirectory = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(event.target.files ?? []))
    setError('')
  }

  const upload = async () => {
    if (selectedFiles.length === 0) return
    const paths = userSkillDirectoryRelativePaths(selectedFiles)
    if (!paths.includes('SKILL.md')) {
      setError('所选目录根必须直接包含 SKILL.md')
      return
    }
    const form = new FormData()
    selectedFiles.forEach((file, index) => {
      form.append('files', file, file.name)
      form.append('relative_paths', paths[index] ?? file.name)
    })
    setUploading(true)
    setError('')
    try {
      await api.post('user-skills', { body: form, timeout: 120_000 })
      setSelectedFiles([])
      if (inputRef.current) inputRef.current.value = ''
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Skill 上传失败')
    } finally {
      setUploading(false)
    }
  }

  const remove = async (skill: PersonalSkillVersion) => {
    if (!window.confirm(`删除 ${skill.display_name} 的全部版本并停用所有 Agent 绑定？`)) return
    setError('')
    try {
      await api.delete(`user-skills/${encodeURIComponent(skill.skill_key)}`)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Skill 删除失败')
    }
  }

  const latestByKey = new Set<string>()
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white text-[#181d26]" aria-labelledby="personal-skills-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dddddd] px-4 py-3">
        <div>
          <h2 id="personal-skills-title" className="text-base font-medium">我的 Skills</h2>
          <p className="mt-1 text-sm text-[#41454d]">上传完整目录；带脚本版本必须审核通过后才能运行。</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading} aria-label="刷新个人 Skills">
          <RefreshCw className={loading ? 'animate-spin' : ''} />刷新
        </Button>
      </header>

      {!data.capability_enabled ? (
        <div className="m-4 flex items-start gap-3 rounded-md border border-[#dddddd] bg-[#f8fafc] p-4" role="status">
          <ShieldAlert className="mt-0.5 size-5" />
          <div><p className="text-sm font-medium">当前 App 尚未开启个人 Skill</p><p className="mt-1 text-sm text-[#41454d]">App 管理员开启后，已有 Skill 和绑定会自动恢复。</p></div>
        </div>
      ) : (
        <div className="border-b border-[#dddddd] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={(node) => {
                inputRef.current = node
                node?.setAttribute('webkitdirectory', '')
                node?.setAttribute('directory', '')
              }}
              className="sr-only" type="file" multiple onChange={selectDirectory} aria-label="选择 Skill 目录"
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()}><FolderUp />选择目录</Button>
            <span className="text-sm text-[#41454d]">{selectedFiles.length > 0 ? `已选择 ${selectedFiles.length} 个文件` : '尚未选择目录'}</span>
            <Button onClick={() => void upload()} disabled={selectedFiles.length === 0 || uploading}>{uploading ? '上传中…' : '上传'}</Button>
          </div>
        </div>
      )}

      {error && <p className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="正在加载个人 Skills">
            {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-[#f8fafc]" />)}
          </div>
        ) : data.skills.length === 0 ? (
          <div className="py-12 text-center" role="status"><p className="text-sm font-medium">暂无个人 Skill</p><p className="mt-1 text-sm text-[#41454d]">选择一个根目录含 SKILL.md 的目录开始上传。</p></div>
        ) : (
          <ul className="divide-y divide-[#dddddd] rounded-md border border-[#dddddd]" role="list">
            {data.skills.map((skill) => {
              const isLatest = !latestByKey.has(skill.skill_key)
              latestByKey.add(skill.skill_key)
              const detail = skill.review_note || skill.publish_last_error
              return (
                <li key={skill.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{skill.display_name}</span><span className="text-xs text-[#41454d]">v{skill.version_number}</span>{skill.contains_scripts && <Badge variant="warning">含脚本</Badge>}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><Badge variant={statusVariant(skill.status)}>{statusLabels[skill.status] ?? skill.status}</Badge>{detail && <span className="text-xs text-[#41454d]">{detail}</span>}</div>
                  </div>
                  {isLatest && <Button variant="destructive" size="icon" onClick={() => void remove(skill)} aria-label={`删除 ${skill.display_name}`}><Trash2 /></Button>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

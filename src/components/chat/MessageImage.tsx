import { useEffect, useState } from 'react'
import { FileImage, RefreshCw } from 'lucide-react'
import { useOptionalBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import { storagePreviewPresignPayload } from '../../lib/storage-presign.js'
import { ImagePreview } from './ImagePreview.js'

interface Props {
  channelId?: string
  src: string
  alt?: string
  title?: string
  storageRef?: string | null
  className?: string
}

export function MessageImage({ channelId, src, alt = '', title, storageRef, className }: Props) {
  const beeSeed = useOptionalBeeSeedContext()
  const [attempt, setAttempt] = useState(0)
  const [resolvedSrc, setResolvedSrc] = useState(() => storageRef && beeSeed && !beeSeed.config.useMockData ? '' : src)
  const [failed, setFailed] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    setPreviewOpen(false)

    if (!storageRef || !channelId || !beeSeed || beeSeed.config.useMockData) {
      setResolvedSrc(src)
      return
    }

    setResolvedSrc('')
    void beeSeed.api.post(`channels/${channelId}/storage/presign-download`, {
      json: storagePreviewPresignPayload(storageRef),
    }).json<{ url: string }>()
      .then((data) => {
        if (!cancelled) setResolvedSrc(data.url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => { cancelled = true }
  }, [attempt, beeSeed, channelId, src, storageRef])

  if (failed) {
    return (
      <div className="flex min-h-24 max-w-[360px] flex-col items-center justify-center gap-2 rounded-lg border border-[#aa2d00]/30 bg-[#fff8f5] px-4 py-3 text-center" role="alert">
        <FileImage className="h-7 w-7 text-[#aa2d00]" />
        <span className="text-sm text-[#aa2d00]">{alt ? `${alt}加载失败` : '图片加载失败'}</span>
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-[#aa2d00] underline" onClick={() => setAttempt(value => value + 1)}>
          <RefreshCw className="h-3.5 w-3.5" />重新加载
        </button>
      </div>
    )
  }

  if (!resolvedSrc) {
    return (
      <div className="flex min-h-24 w-56 items-center justify-center rounded-lg border border-[#d8dde6] bg-[#f8fafc] text-[#8a919b]" role="status" aria-label={alt ? `正在加载${alt}` : '正在加载图片'}>
        <FileImage className="h-7 w-7" />
      </div>
    )
  }

  return (
    <>
      <img
        src={resolvedSrc}
        alt={alt}
        title={title}
        className={className}
        loading="lazy"
        onError={() => setFailed(true)}
        onClick={() => setPreviewOpen(true)}
      />
      {previewOpen && <ImagePreview src={resolvedSrc} onClose={() => setPreviewOpen(false)} />}
    </>
  )
}

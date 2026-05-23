import { memo, useMemo, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { isLikelyFilePath } from '../../lib/file-path-utils.js'
import { cn } from '../../lib/cn.js'
import { STORAGE_REF_RE, StorageRefChip } from '../../lib/storage-ref.js'

const MENTION_RE = /@([一-鿿\w][一-鿿\w\-]*)/g

function processInlineTokens(
  children: ReactNode,
  onMentionClick?: (name: string) => void,
  onStorageRefClick?: (key: string) => void,
  storageRefAvailable?: (refText: string) => boolean,
): ReactNode {
  if (typeof children === 'string') return splitInlineTokens(children, onMentionClick, onStorageRefClick, storageRefAvailable)
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string') {
        const result = splitInlineTokens(child, onMentionClick, onStorageRefClick, storageRefAvailable)
        if (Array.isArray(result)) {
          return result.map((el, j) =>
            typeof el === 'string' ? el : <span key={`${i}-${j}`}>{el}</span>,
          )
        }
        return result
      }
      return child
    })
  }
  return children
}

function splitInlineTokens(
  text: string,
  onMentionClick?: (name: string) => void,
  onStorageRefClick?: (key: string) => void,
  storageRefAvailable?: (refText: string) => boolean,
): ReactNode {
  const storageParts: ReactNode[] = []
  let lastIndex = 0

  STORAGE_REF_RE.lastIndex = 0
  let storageMatch: RegExpExecArray | null
  while ((storageMatch = STORAGE_REF_RE.exec(text)) !== null) {
    const full = storageMatch[0]
    const idx = storageMatch.index
    if (idx > lastIndex) storageParts.push(text.slice(lastIndex, idx))
    storageParts.push(
      storageRefAvailable?.(full) === true
        ? <StorageRefChip key={`storage-${idx}`} refText={full} onClick={onStorageRefClick} />
        : full,
    )
    lastIndex = idx + full.length
  }
  if (storageParts.length === 0) {
    storageParts.push(text)
  } else if (lastIndex < text.length) {
    storageParts.push(text.slice(lastIndex))
  }

  if (!onMentionClick) return storageParts.length === 1 ? storageParts[0] : storageParts

  const parts: ReactNode[] = []
  for (const part of storageParts) {
    if (typeof part !== 'string') {
      parts.push(part)
      continue
    }
    appendMentionParts(parts, part, onMentionClick)
  }

  return parts.length === 1 ? parts[0] : parts
}

function appendMentionParts(parts: ReactNode[], text: string, onMentionClick: (name: string) => void) {
  let lastIndex = 0
  MENTION_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MENTION_RE.exec(text)) !== null) {
    const [full, name] = match
    const idx = match.index
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx))
    parts.push(
      <span
        key={`mention-${idx}`}
        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[#7c3aed] bg-[#f5f3ff] cursor-pointer hover:bg-[#ede9fe] transition-colors font-medium text-[0.9em]"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMentionClick(name!) }}
      >
        @{name}
      </span>,
    )
    lastIndex = idx + full.length
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
}

interface MarkdownRendererProps {
  content: string
  className?: string
  onMentionClick?: (name: string) => void
  onFileClick?: (path: string) => void
  onStorageRefClick?: (key: string) => void
  storageRefAvailable?: (refText: string) => boolean
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  onMentionClick,
  onFileClick,
  onStorageRefClick,
  storageRefAvailable,
}: MarkdownRendererProps) {
  const processed = useMemo(() => {
    return content
      .replace(/\*\*([''""〈-】〔-〟《》【】（）「」『』、。])/g, '**‍$1')
      .replace(/([''""〈-】〔-〟《》【】（）「」『』、。])\*\*/g, '$1‍**')
  }, [content])

  return (
    <div className={cn('sdk-markdown', className)}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p(props: { children?: ReactNode }) {
            const withMentions = processInlineTokens(props.children, onMentionClick, onStorageRefClick, storageRefAvailable)
            return <p className="my-1 leading-relaxed">{withMentions}</p>
          },
          code(props: { className?: string; children?: ReactNode }) {
            const isBlock = props.className?.startsWith('language-')
            if (isBlock) {
              return (
                <pre className="my-2 overflow-x-auto rounded-lg bg-[#1e1e2e] text-[#cdd6f4] p-3 text-sm">
                  <code className={props.className}>{props.children}</code>
                </pre>
              )
            }
            const text = String(props.children).replace(/\n$/, '')
            if (text.startsWith('storage://')) {
              if (storageRefAvailable?.(text) === true) return <StorageRefChip refText={text} onClick={onStorageRefClick} />
              return (
                <code className="px-1.5 py-0.5 rounded bg-muted text-[0.9em] font-mono">
                  {props.children}
                </code>
              )
            }
            if (onFileClick && isLikelyFilePath(text)) {
              return (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[0.9em] cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => onFileClick(text)}
                >
                  📄 {text.split('/').pop()}
                </span>
              )
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-muted text-[0.9em] font-mono">
                {props.children}
              </code>
            )
          },
          pre(props: { children?: ReactNode }) {
            return <>{props.children}</>
          },
          a(props: { children?: ReactNode; href?: string }) {
            if (props.href?.startsWith('storage://')) {
              if (storageRefAvailable?.(props.href) === true) return <StorageRefChip refText={props.href} onClick={onStorageRefClick} />
              return <span>{props.children ?? props.href}</span>
            }
            return (
              <a
                className="text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                href={props.href}
              >
                {props.children}
              </a>
            )
          },
          ul(props: { children?: ReactNode }) {
            return <ul className="my-1 ml-4 list-disc space-y-0.5">{props.children}</ul>
          },
          ol(props: { children?: ReactNode }) {
            return <ol className="my-1 ml-4 list-decimal space-y-0.5">{props.children}</ol>
          },
          blockquote(props: { children?: ReactNode }) {
            return (
              <blockquote className="my-2 border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground italic">
                {props.children}
              </blockquote>
            )
          },
          table(props: { children?: ReactNode }) {
            return (
              <div className="my-2 overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">{props.children}</table>
              </div>
            )
          },
          th(props: { children?: ReactNode }) {
            return <th className="border border-muted px-2 py-1 bg-muted/50 text-left font-medium">{props.children}</th>
          },
          td(props: { children?: ReactNode }) {
            return <td className="border border-muted px-2 py-1">{props.children}</td>
          },
          h1(props: { children?: ReactNode }) { return <h1 className="text-xl font-bold mt-4 mb-2">{props.children}</h1> },
          h2(props: { children?: ReactNode }) { return <h2 className="text-lg font-bold mt-3 mb-1.5">{props.children}</h2> },
          h3(props: { children?: ReactNode }) { return <h3 className="text-base font-semibold mt-2 mb-1">{props.children}</h3> },
          hr() { return <hr className="my-3 border-muted" /> },
        }}
      >
        {processed}
      </Markdown>
    </div>
  )
})

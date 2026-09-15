const URL_TEXT_RE = /https?:\/\/[^\s<>"`（，。；：！？]+/gi
const SIGNING_KEY_RE = /^(?:signature|ossaccesskeyid|security-token|x-(?:amz|oss|tos|goog)-(?:signature|credential|security-token))$/i
export const HIDDEN_FILE_LINK = '临时文件链接（签名已隐藏）'

function signedFileURL(value: string): URL | null {
  try {
    const url = new URL(value.replace(/&amp;/gi, '&'))
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return Array.from(url.searchParams.keys()).some(key => SIGNING_KEY_RE.test(key)) ? url : null
  } catch {
    return null
  }
}

function displaySignedURL(value: string, channelId?: string): string | null {
  const url = signedFileURL(value)
  if (!url) return null
  if (channelId) {
    const match = url.pathname.match(/^\/apps\/[^/]+\/channels\/([^/]+)\/(.+)$/)
    if (match?.[1] === channelId) {
      try {
        const key = decodeURIComponent(match[2]!)
        const parts = key.split('/')
        if (parts.every(part => part && part !== '.' && part !== '..') && !/[\r\n\\]/.test(key)) {
          return 'storage://' + parts.map(part => encodeURIComponent(part).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())).join('/')
        }
      } catch { /* An invalid encoded path is not a file reference. */ }
    }
  }
  return HIDDEN_FILE_LINK
}

// Presentation only: never use this result as a runtime tool receipt or an HTTP request.
export function displayFileLinks(text: string, channelId?: string): string {
  return text.replace(URL_TEXT_RE, value => {
    const url = value.replace(/[\])}）.,;!?]+$/, '')
    const display = displaySignedURL(url, channelId)
    return display ? display + value.slice(url.length) : value
  })
}

interface MarkdownNode {
  type: string
  value?: string
  url?: string
  alt?: string | null
  title?: string | null
  children?: MarkdownNode[]
}

// Work on parsed Markdown so an image's opaque source URL remains usable.
// Signed file hyperlinks become the existing storage chip or inert visible text.
export function signedFileLinksRemark(channelId?: string) {
  return function plugin() {
    return function transform(tree: MarkdownNode) {
      const visit = (node: MarkdownNode) => {
        if (node.type === 'link' && node.url) {
          const display = displaySignedURL(node.url, channelId)
          if (display) {
            node.type = 'text'
            node.value = display
            delete node.url
            delete node.children
          }
        }
        if (node.value) node.value = displayFileLinks(node.value, channelId)
        if (node.alt) node.alt = displayFileLinks(node.alt, channelId)
        if (node.title) node.title = displayFileLinks(node.title, channelId)
        node.children?.forEach(visit)
      }
      visit(tree)
    }
  }
}

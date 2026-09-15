import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { displayFileLinks, HIDDEN_FILE_LINK } from './signed-file-links.js'
import { MarkdownRenderer } from '../components/chat/MarkdownRenderer.js'

const channel = 'channel-a'
const raw = 'https://storage.example.invalid/apps/app-a/channels/channel-a/docs/report.pdf?OSSAccessKeyId=qa-credential&Expires=1&Signature=qa-signature'

describe('signed file link presentation', () => {
  it('restores only current-channel references and preserves ordinary URLs', () => {
    expect(displayFileLinks(raw, channel)).toBe('storage://docs/report.pdf')
    expect(displayFileLinks(raw, 'channel-b')).toBe(HIDDEN_FILE_LINK)
    expect(displayFileLinks(raw)).toBe(HIDDEN_FILE_LINK)
    const ordinary = 'https://example.invalid/report.pdf?chapter=2'
    expect(displayFileLinks(ordinary, channel)).toBe(ordinary)
    expect(displayFileLinks(raw.replace('docs/report.pdf', 'docs/report%20%28final%29.pdf'), channel)).toBe('storage://docs/report%20%28final%29.pdf')
    expect(displayFileLinks('(' + raw.replace('docs/report.pdf', 'docs/report(final).pdf') + ')', channel)).toBe('(storage://docs/report%28final%29.pdf)')
  })

  it('hides credentials for every streamed prefix once their values start arriving', () => {
    const firstValue = raw.indexOf('qa-credential')
    for (let length = firstValue + 1; length <= raw.length; length++) {
      const prefix = raw.slice(0, length)
      const visible = displayFileLinks(prefix)
      expect(visible).not.toContain('OSSAccessKeyId')
      expect(visible).not.toContain('qa-signature')
    }
  })

  it('renders signed bare URLs, Markdown links and code without sensitive text', () => {
    for (const content of [raw, `[原文件](${raw})`, '`' + raw + '`', '```text\n' + raw + '\n```']) {
      const html = renderToStaticMarkup(<MarkdownRenderer content={content} channelId={channel} />)
      expect(html).not.toContain('OSSAccessKeyId')
      expect(html).not.toContain('qa-signature')
      expect(html).toContain('report.pdf')
    }
    const foreign = renderToStaticMarkup(<MarkdownRenderer content={`[原文件](${raw})`} channelId="channel-b" />)
    expect(foreign).not.toContain('<a')
    expect(foreign).not.toContain('<button')
    expect(foreign).toContain(HIDDEN_FILE_LINK)
  })

  it('keeps opaque image sources intact while hiding signed links in visible text', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content={`![图](<${raw}>)\n[文件](${raw})`} channelId={channel} />)
    expect(html).toContain('<img src="https://storage.example.invalid/')
    expect(html).toContain('Signature=qa-signature" alt="图"')
    const visible = html.replace(/<[^>]*>/g, '')
    expect(visible).not.toContain('qa-signature')
    expect(visible).toContain('report.pdf')
  })
})

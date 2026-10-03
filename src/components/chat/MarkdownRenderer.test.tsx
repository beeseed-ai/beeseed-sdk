import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { markdownImageContext, markdownImageRendererContext } from './MarkdownImageRendering.js'
import { MarkdownRenderer } from './MarkdownRenderer.js'

describe('MarkdownRenderer message image extension', () => {
  it('keeps the default image when no custom renderer is configured', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content="![普通图片](https://example.com/image.png)" />)

    expect(html).toContain('<img src="https://example.com/image.png" alt="普通图片"/>')
  })

  it('passes message context to the custom image renderer', () => {
    const renderer = vi.fn(({ src, context }) => (
      <span data-source={src} data-timestamp={context?.messageTimestamp}>专属图片</span>
    ))

    const html = renderToStaticMarkup(
      <markdownImageRendererContext.Provider value={renderer}>
        <markdownImageContext.Provider value={{ messageId: 8, messageTimestamp: 1786204800000, senderId: 'agent-1' }}>
          <MarkdownRenderer content="![耳中](/cards/er-zhong.png)" />
        </markdownImageContext.Provider>
      </markdownImageRendererContext.Provider>,
    )

    expect(renderer).toHaveBeenCalledOnce()
    expect(renderer.mock.calls[0]?.[0].context).toEqual({
      messageId: 8,
      messageTimestamp: 1786204800000,
      senderId: 'agent-1',
    })
    expect(html).toContain('data-source="/cards/er-zhong.png"')
    expect(html).toContain('专属图片')
  })
})

describe('MarkdownRenderer storage references', () => {
  it('renders an existing cloud file as a clickable chip', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        content="`storage://notes/task.md`"
        storageRefAvailable={(refText) => refText === 'storage://notes/task.md'}
      />,
    )

    expect(html).toContain('<button')
    expect(html).toContain('title="storage://notes/task.md"')
    expect(html).toContain('storage://notes/task.md')
  })

  it('renders an unavailable encoded storage URI as full decoded ordinary text', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        content="storage://%E6%AF%8F%E6%97%A5%E6%96%B0%E9%97%BB/00649d8d-%E6%AF%8F%E6%97%A5%E6%96%B0%E9%97%BB_20260926.md"
        onStorageRefClick={() => {}}
        storageRefAvailable={() => false}
      />,
    )

    expect(html).not.toContain('<button')
    expect(html).toContain('storage://每日新闻/00649d8d-每日新闻_20260926.md')
    expect(html).not.toContain('%E6%AF%8F')
  })

  it('hides a generated UUID prefix from an available reference without changing its click target', () => {
    const ref = 'storage://%E6%AF%8F%E6%97%A5%E6%96%B0%E9%97%BB/da7d0da1-ebdd-4475-ad27-5a18efc03a40-%E6%AF%8F%E6%97%A5%E6%96%B0%E9%97%BB_20260928.md'
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        content={ref}
        onStorageRefClick={() => {}}
        storageRefAvailable={() => true}
      />,
    )

    expect(html).toContain('storage://每日新闻/每日新闻_20260928.md')
    expect(html).not.toContain('da7d0da1-ebdd-4475-ad27-5a18efc03a40')
  })

  it('keeps an unavailable encoded storage URI in inline code readable and non-clickable', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        content="`storage://%E6%AF%8F%E6%97%A5%E6%96%B0%E9%97%BB/report.md`"
        storageRefAvailable={() => false}
      />,
    )

    expect(html).not.toContain('<button')
    expect(html).toContain('<code')
    expect(html).toContain('storage://每日新闻/report.md')
    expect(html).not.toContain('%E6%AF%8F')
  })

  it('keeps a missing workspace path as ordinary text', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        content="Temporary file workspace/task.md"
        storageRefAvailable={() => false}
      />,
    )

    expect(html).not.toContain('<button')
    expect(html).toContain('workspace/task.md')
  })

  it('keeps a missing cloud-file link as non-clickable content', () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        content="[task.md](workspace/task.md)"
        storageRefAvailable={() => false}
      />,
    )

    expect(html).not.toContain('<button')
    expect(html).not.toContain('<a')
    expect(html).toContain('task.md')
  })
})

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
    expect(html).toContain('title="notes/task.md"')
    expect(html).toContain('task.md')
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

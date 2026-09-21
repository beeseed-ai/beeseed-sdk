import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TypingIndicator } from './TypingIndicator.js'

describe('TypingIndicator', () => {
  it('matches the finished-run process row shell and type scale', () => {
    const html = renderToStaticMarkup(<TypingIndicator text="准备中" />)

    expect(html).toContain('mb-1 flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md border border-[#dddddd] bg-white px-2.5 py-1.5 text-left text-xs')
    expect(html).toContain('准备中')
  })

  it('keeps the chevron slot without becoming expandable', () => {
    const html = renderToStaticMarkup(<TypingIndicator text="思考中" />)

    // Placeholder arrow, matching the transcript row's glyph and size.
    expect(html).toContain('size-3 shrink-0 text-[#777169]')
    expect(html).not.toContain('aria-expanded')
    expect(html).not.toContain('<button')
  })

  it('renders nothing without a label', () => {
    expect(renderToStaticMarkup(<TypingIndicator text="" />)).toBe('')
  })
})

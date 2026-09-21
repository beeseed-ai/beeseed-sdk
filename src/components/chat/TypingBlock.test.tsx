import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ChannelMemberInfo } from '../../core/types.js'
import { TypingBlock } from './TypingBlock.js'

const members = [
  { agent_id: 'content-writer', display_name: '写作助手', member_type: 'agent' },
] as ChannelMemberInfo[]

describe('TypingBlock', () => {
  it('renders the agent display name rather than the raw id', () => {
    const html = renderToStaticMarkup(
      <TypingBlock entry={{ agentId: 'content-writer', text: '准备中' }} members={members} />,
    )

    expect(html).toContain('写作助手')
    expect(html).not.toContain('content-writer')
  })

  it('renders the status inside the same card shell a finished run uses', () => {
    const html = renderToStaticMarkup(
      <TypingBlock entry={{ agentId: 'content-writer', text: '思考中' }} members={members} />,
    )

    expect(html).toContain('思考中')
    expect(html).toContain('rounded-md border border-[#dddddd] bg-white')
  })

  it('falls back to the raw id when the member list has no entry', () => {
    const html = renderToStaticMarkup(<TypingBlock entry={{ agentId: 'unknown-agent', text: '准备中' }} />)

    expect(html).toContain('unknown-agent')
  })
})

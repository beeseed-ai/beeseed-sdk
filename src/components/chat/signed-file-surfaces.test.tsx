// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentLoopState, AgentLoopToolCall, ChatMessage } from '../../core/types.js'
import { MessageBubble } from './MessageBubble.js'
import { AgentRunTranscript } from './AgentRunTranscript.js'
import { ThinkingBlock } from './ThinkingBlock.js'
import { ToolGroupBubble } from './ToolGroupBubble.js'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

vi.mock('./StorageAttachmentPreview.js', () => ({
  StorageAttachmentPreview: () => null,
  StoragePreviewDialog: () => null,
  useExistingStorageRefs: (_channel: string, refs: string[]) => ({ existingRefs: refs, isExistingRef: () => true }),
}))
const raw = 'https://storage.example.invalid/apps/app-a/channels/channel-a/docs/report.pdf?OSSAccessKeyId=qa-credential&Signature=qa-signature'
let root: Root | undefined
let host: HTMLDivElement
afterEach(async () => { if (root) await act(() => root?.unmount()); host?.remove(); vi.restoreAllMocks() })
async function render(node: ReactNode) {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  await act(() => root!.render(node))
}
function expectPrivateTextHidden() {
  expect(host.textContent).not.toContain('qa-credential')
  expect(host.textContent).not.toContain('qa-signature')
  expect(host.textContent).not.toContain('OSSAccessKeyId')
}

describe('signed file links across chat controls', () => {
  it('copies and quotes the stable file reference without changing source messages', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const quote = vi.fn()
    const message: ChatMessage = { role: 'assistant', content: raw, timestamp: 1000, isAgent: true }
    await render(<MessageBubble message={message} isOwn={false} channelId="channel-a" onQuote={quote} />)
    expectPrivateTextHidden()
    const copyButton = [...host.querySelectorAll('button')].find(b => b.textContent === '复制')
    expect(copyButton).toBeTruthy()
    await act(() => copyButton!.click())
    expect(writeText).toHaveBeenCalledWith('storage://docs/report.pdf')
    const quoteButton = [...host.querySelectorAll('button')].find(b => b.textContent === '引用')
    expect(quoteButton).toBeTruthy()
    await act(() => quoteButton!.click())
    expect(quote).toHaveBeenCalledWith(expect.objectContaining({ content: 'storage://docs/report.pdf' }))
    expect(message.content).toBe(raw)
  })

  for (const eventMode of [false, true]) it(`hides signed text in expanded ${eventMode ? 'event' : 'turn'} records`, async () => {
    const tool: AgentLoopToolCall = { id: 'call-a', name: 'storage_presign_download', status: 'success', startedAt: 1000, output: raw, args: { nested: { download: raw } } }
    const loop: AgentLoopState = {
      agentId: 'assistant', channelId: 'channel-a', status: 'running', currentTurn: 1, startedAt: 1000,
      turns: [{ turnNumber: 1, thinking: raw, progress: raw, content: raw, toolCalls: [tool], skillUses: [], status: 'active', startedAt: 1000 }],
      events: eventMode ? [
        { id: 'p', type: 'progress', turnNumber: 1, timestamp: 1000, summary: raw },
        { id: 'c', type: 'tool_call', turnNumber: 1, timestamp: 1001, tool },
        { id: 'r', type: 'tool_result', turnNumber: 1, timestamp: 1002, tool },
        { id: 't', type: 'assistant_content', turnNumber: 1, timestamp: 1003, content: raw },
      ] : undefined,
    }
    await render(<AgentRunTranscript loop={loop} />)
    expectPrivateTextHidden()
    await act(() => host.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!.click())
    for (const button of [...host.querySelectorAll('button')].filter(b => b.textContent?.includes('storage_presign_download'))) {
      await act(() => button.click())
    }
    expectPrivateTextHidden()
    expect(host.querySelector('pre')).not.toBeNull()
    expect(tool.output).toBe(raw)
  })

  it('hides signed text in standalone thinking and legacy tool details', async () => {
    await render(<><ThinkingBlock content={raw} /><ToolGroupBubble messages={[{ role: 'tool', timestamp: 1000, content: raw, toolKind: 'result', toolName: 'storage_presign_download', toolSuccess: true }]} /></>)
    await act(() => host.querySelector<HTMLButtonElement>('button')!.click())
    const tool = [...host.querySelectorAll('div')].find(e => e.classList.contains('cursor-pointer') && e.textContent?.includes('storage_presign_download'))
    expect(tool).toBeTruthy()
    await act(() => tool!.click())
    expectPrivateTextHidden()
    expect(host.querySelector('pre')).not.toBeNull()
  })
})

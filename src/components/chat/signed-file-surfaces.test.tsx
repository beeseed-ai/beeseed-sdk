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

  it('shows settled points after the assistant message actions', async () => {
    const message: ChatMessage = { role: 'assistant', content: '处理完成', timestamp: 1000, isAgent: true }
    await render(<MessageBubble message={message} isOwn={false} channelId="channel-a" onQuote={vi.fn()} actualCostPoints={243.9456} />)

    expect(host.textContent).toContain('复制')
    expect(host.textContent).toContain('引用')
    expect(host.textContent).toContain('· 消耗 243.95 积分')
  })

  it('keeps copy and quote actions beside settled points for an Agent Run final answer', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const quote = vi.fn()
    const finalMessage: ChatMessage = {
      role: 'assistant', content: raw, timestamp: 2000, msgId: 42,
      isAgent: true, senderType: 'agent', senderId: 'assistant', agentRunId: 'run-actions',
    }
    const loop: AgentLoopState = {
      runId: 'run-actions', historySource: 'runtime', agentId: 'assistant', channelId: 'channel-a',
      status: 'completed', currentTurn: 1, startedAt: 1000, completedAt: 2000,
      finalContent: raw, actualCostPoints: 0.48,
      turns: [{ turnNumber: 1, toolCalls: [], skillUses: [], status: 'completed', startedAt: 1000, completedAt: 2000 }],
    }

    await render(<AgentRunTranscript loop={loop} finalMessage={finalMessage} onQuote={quote} />)

    expectPrivateTextHidden()
    expect(host.textContent).toContain('复制')
    expect(host.textContent).toContain('引用')
    expect(host.textContent).toContain('· 消耗 0.48 积分')
    await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="复制回复"]')!.click())
    expect(writeText).toHaveBeenCalledWith('storage://docs/report.pdf')
    await act(() => host.querySelector<HTMLButtonElement>('button[aria-label="引用回复"]')!.click())
    expect(quote).toHaveBeenCalledWith(expect.objectContaining({ content: 'storage://docs/report.pdf' }))
    expect(finalMessage.content).toBe(raw)
  })

  it('references a historical Agent artifact by its stable storage ref', async () => {
    const referenceFile = vi.fn()
    const finalMessage: ChatMessage = {
      role: 'assistant', content: '文件已生成', timestamp: 2000, msgId: 43,
      isAgent: true, senderType: 'agent', senderId: 'assistant', agentRunId: 'run-artifact-reference',
      artifacts: [{
        artifactId: 'artifact-a', objectId: 'object-a', storageRef: 'storage://reports/项目报告.pdf',
        fileName: '项目报告.pdf', artifactKind: 'pdf', editable: false,
      }],
    }
    const loop: AgentLoopState = {
      runId: 'run-artifact-reference', historySource: 'runtime', agentId: 'assistant', channelId: 'channel-a',
      status: 'completed', currentTurn: 1, startedAt: 1000, completedAt: 2000,
      finalContent: '文件已生成',
      turns: [{ turnNumber: 1, toolCalls: [], skillUses: [], status: 'completed', startedAt: 1000, completedAt: 2000 }],
    }

    await render(<AgentRunTranscript loop={loop} finalMessage={finalMessage} onReferenceFile={referenceFile} />)
    const button = host.querySelector<HTMLButtonElement>('[aria-label="引用文件到聊天：项目报告.pdf"]')
    expect(button).not.toBeNull()
    expect(button?.className).toContain('md:group-hover/artifact:opacity-100')
    await act(() => button!.click())
    expect(referenceFile).toHaveBeenCalledWith('storage://reports/项目报告.pdf')
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

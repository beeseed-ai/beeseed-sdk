import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AgentLoopState, ChatMessage } from '../../core/types.js'
import { AgentRunTranscript } from './AgentRunTranscript.js'

vi.mock('./StorageAttachmentPreview.js', () => ({
  StorageAttachmentPreview: () => null,
  StoragePreviewDialog: () => null,
  useExistingStorageRefs: () => ({
    existingRefs: [],
    isExistingRef: () => true,
  }),
}))

describe('AgentRunTranscript', () => {
  it.each([
    ['completed', '本次处理已完成'],
    ['error', '处理失败'],
    ['stopped', '用户已停止本次处理'],
    ['interrupted', '本次处理已中断'],
    ['waiting_expired', '等待用户回答已超时'],
    ['max_turns_reached', '已达到最大处理轮数'],
  ] as const)('%s 不使用迟到的工具调用作为当前摘要', (status, summary) => {
    const loop: AgentLoopState = {
      runId: 'terminal-run', agentId: 'assistant', channelId: 'channel-1',
      status, currentTurn: 1, startedAt: 1000, completedAt: 2000, turns: [],
      events: [{ id: 'late-tool', type: 'tool_call', turnNumber: 1, timestamp: 2100,
        tool: { id: 'ask', name: 'ask_user', status: 'calling', startedAt: 1900 } }],
    }
    const html = renderToStaticMarkup(<AgentRunTranscript loop={loop} />)
    expect(html).toContain(summary)
    expect(html).not.toContain('正在调用')
  })

  it('等待回答时不把进程的 completed idle 当作用户状态', () => {
    const loop: AgentLoopState = {
      runId: 'waiting-run', agentId: 'assistant', channelId: 'channel-1',
      status: 'waiting_for_user', currentTurn: 1, startedAt: 1000, completedAt: 2000,
      turns: [{ turnNumber: 1, toolCalls: [], skillUses: [], status: 'completed', startedAt: 1000, progress: 'completed · idle' }],
      events: [{ id: 'late-progress', type: 'progress', turnNumber: 1, timestamp: 2000, summary: 'completed · idle' }],
    }
    const html = renderToStaticMarkup(<AgentRunTranscript loop={loop} />)
    expect(html).toContain('等待用户回答')
    expect(html).toContain('等待用户补充信息')
    expect(html).not.toContain('completed · idle')
  })

  it('keeps persisted runtime summaries expandable before details are loaded', () => {
    const loop: AgentLoopState = {
      runId: 'runtime-run', historySource: 'runtime', agentId: 'assistant', channelId: 'channel-1',
      status: 'completed', currentTurn: 1, startedAt: 1000, completedAt: 2000,
      finalContent: '唯一最终结果',
      turns: [{ turnNumber: 1, toolCalls: [], skillUses: [], status: 'completed', startedAt: 1000, completedAt: 2000 }],
    }
    const html = renderToStaticMarkup(<AgentRunTranscript loop={loop} onProcessOpen={vi.fn()} />)
    expect(html).toContain('aria-expanded="false"')
    expect(html.match(/唯一最终结果/g)).toHaveLength(1)
  })

  it('renders final message artifacts without requiring a history refresh', () => {
    const loop: AgentLoopState = {
      agentId: 'content-writer',
      channelId: 'channel-1',
      runId: 'run-1',
      turns: [],
      status: 'completed',
      currentTurn: 1,
      startedAt: 1000,
      completedAt: 2000,
      finalContent: '文件位置：**`/workspace/artifacts/demo.pptx`**',
    }
    const finalMessage: ChatMessage = {
      role: 'assistant',
      content: loop.finalContent!,
      timestamp: 2000,
      msgId: 42,
      isAgent: true,
      senderType: 'agent',
      senderId: 'content-writer',
      agentRunId: 'run-1',
      artifacts: [{
        artifactId: 'artifact-1',
        storageRef: 'storage://workspace/artifacts/demo.pptx',
        fileName: 'demo.pptx',
        artifactKind: 'pptx',
        version: 1,
        editable: true,
      }],
    }

    const html = renderToStaticMarkup(
      <AgentRunTranscript loop={loop} finalMessage={finalMessage} onReviseArtifact={vi.fn()} />,
    )

    expect(html).toContain('aria-label="预览文件：demo.pptx"')
    expect(html).toContain('演示文稿 · v1')
    expect(html).toContain('修改')
  })
})

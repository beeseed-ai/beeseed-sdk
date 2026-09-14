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

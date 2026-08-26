import { describe, expect, it } from 'vitest'

import type { AgentLoopState } from '../core/types.js'
import { applyLocalAgentRunsToLoops } from './messages.js'

function runningLoop(runId: string): AgentLoopState {
  return {
    runId,
    agentId: 'agent-1',
    channelId: 'channel-1',
    status: 'running',
    currentTurn: 1,
    startedAt: Date.parse('2026-08-17T00:00:00.000Z'),
    turns: [{
      turnNumber: 1,
      status: 'active',
      startedAt: Date.parse('2026-08-17T00:00:00.000Z'),
      toolCalls: [],
      skillUses: [],
    }],
  }
}

describe('本地 Agent 历史运行状态', () => {
  it.each([
    ['cancelled', 'stopped', '技能任务已取消。'],
    ['expired', 'error', '技能任务已过期。'],
  ] as const)('将 %s 运行收敛为非处理中状态', (runStatus, expectedStatus, expectedSummary) => {
    const loops = new Map([['channel-1:agent-1:run-1', runningLoop('run-1')]])
    const hydrated = applyLocalAgentRunsToLoops('channel-1', loops, [{
      run_id: 'run-1',
      status: runStatus,
      completed_at: '2026-08-17T00:01:00.000Z',
    }])
    const loop = hydrated.get('channel-1:agent-1:run-1')

    expect(loop?.status).toBe(expectedStatus)
    expect(loop?.error).toBe(expectedSummary)
    expect(loop?.completedAt).toBe(Date.parse('2026-08-17T00:01:00.000Z'))
  })
})

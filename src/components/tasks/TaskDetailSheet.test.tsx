// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChannelMemberInfo, Task } from '../../core/types.js'
import { TaskDetailSheet } from './TaskDetailSheet.js'

const api = vi.hoisted(() => ({ updateTask: vi.fn(), getComments: vi.fn(), addComment: vi.fn() }))
vi.mock('../../hooks/use-tasks.js', () => ({ useTasks: () => api }))

const task: Task = {
  id: 'task-retry', channel_id: 'channel-test', title: '失败任务', description: '读取旧文件',
  status: 'failed', scheduler_state: 'failed', assigned_type: 'agent', assigned_agent_id: 'assistant',
  priority: 0, created_at: '2026-09-15T00:00:00Z', updated_at: '2026-09-15T00:00:00Z',
}
const members = ['assistant', 'writer'].map(agent_id => ({
  id: agent_id, member_type: 'agent', agent_id, display_name: agent_id,
})) as ChannelMemberInfo[]
let host: HTMLDivElement, root: Root
const onClose = vi.fn()

async function render(current = task, open = true) {
  await act(async () => root.render(<TaskDetailSheet channelId={current.channel_id} task={current}
    members={members} open={open} onClose={onClose} />))
}
async function edit(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const proto = Object.getPrototypeOf(element)
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}
async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find(el => el.textContent?.trim() === text)!
  await act(async () => button.click())
}
const description = () => host.querySelector<HTMLTextAreaElement>('textarea[placeholder="描述（可选）"]')!
const status = () => host.querySelectorAll('select')[0]!
const assignee = () => host.querySelectorAll('select')[1]!

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  api.getComments.mockResolvedValue([])
  api.updateTask.mockResolvedValue(undefined)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('任务详情的统一保存', () => {
  it('编辑失败任务后选择待处理不会提前派发，保存只发送一次新描述和状态', async () => {
    await render()
    await edit(description(), '只回复新的恢复标记')
    await edit(status(), 'pending')
    expect(api.updateTask).not.toHaveBeenCalled()
    await click('保存')
    expect(api.updateTask).toHaveBeenCalledTimes(1)
    expect(api.updateTask).toHaveBeenCalledWith(task.id, {
      title: task.title, description: '只回复新的恢复标记', due_at: null, status: 'pending',
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('选择执行人同样等待保存，并与正文一起提交', async () => {
    await render({ ...task, status: 'pending', assigned_agent_id: undefined, assigned_type: undefined })
    await edit(assignee(), 'writer')
    await edit(description(), '由新执行人执行')
    expect(api.updateTask).not.toHaveBeenCalled()
    await click('保存')
    expect(api.updateTask).toHaveBeenCalledWith(task.id, expect.objectContaining({
      description: '由新执行人执行', assigned_agent_id: 'writer', assigned_type: 'agent',
    }))
  })

  it('关闭再打开同一任务会放弃所有未保存的草稿', async () => {
    await render()
    await edit(description(), '未保存描述')
    await edit(status(), 'pending')
    await edit(assignee(), 'writer')
    await act(async () => host.querySelector<HTMLButtonElement>('button[title="关闭"]')!.click())
    await render(task, false)
    await render()
    expect(description().value).toBe(task.description)
    expect(status().value).toBe('failed')
    expect(assignee().value).toBe('assistant')
    expect(api.updateTask).not.toHaveBeenCalled()
  })

  it('只修改正文时不覆盖编辑期间服务器更新的任务状态和执行人', async () => {
    await render()
    await edit(description(), '补充任务说明')
    await render({ ...task, status: 'in_progress', assigned_agent_id: 'writer' })
    expect(status().value).toBe('in_progress')
    expect(assignee().value).toBe('writer')
    await click('保存')
    const patch = api.updateTask.mock.calls[0][1]
    expect(patch.description).toBe('补充任务说明')
    expect(patch).not.toHaveProperty('status')
    expect(patch).not.toHaveProperty('assigned_agent_id')
  })

  it('验收仍是独立操作，不顺带保存正文草稿', async () => {
    await render({ ...task, verification_status: 'pending', scheduler_state: 'awaiting_verify' })
    await edit(description(), '未保存说明')
    await click('验收通过')
    expect(api.updateTask).toHaveBeenCalledExactlyOnceWith(task.id, { verification_status: 'accepted' })
  })
})

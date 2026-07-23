import { describe, expect, it } from 'vitest'

import { normalizeChannelTemplateScheduledTasks } from './channelTemplateSchedule'

describe('normalizeChannelTemplateScheduledTasks', () => {
  it('保留后台编辑界面不展示的共享推送配置', () => {
    const [task] = normalizeChannelTemplateScheduledTasks([{
      id: 'daily',
      title: '每日新闻',
      cron_expr: '0 7 * * *',
      delivery_mode: 'shared_broadcast',
      shared_execution_key: '  earseek-daily-news  ',
      content_policy: 'inline_markdown_required',
    }], 'assistant', () => 'generated')

    expect(task).toMatchObject({
      id: 'daily',
      delivery_mode: 'shared_broadcast',
      shared_execution_key: 'earseek-daily-news',
      content_policy: 'inline_markdown_required',
    })
  })

  it('不把普通定时任务隐式升级为共享推送', () => {
    const [task] = normalizeChannelTemplateScheduledTasks([{
      title: '普通任务',
      cron_expr: '0 9 * * *',
      shared_execution_key: 'unused-key',
      content_policy: 'inline_markdown_required',
    }], 'assistant', () => 'generated')

    expect(task.delivery_mode).toBeUndefined()
    expect(task.shared_execution_key).toBeUndefined()
    expect(task.content_policy).toBeUndefined()
  })
})

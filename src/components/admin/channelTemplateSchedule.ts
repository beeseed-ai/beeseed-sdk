export interface ChannelTemplateScheduledTask {
  id?: string
  title: string
  description?: string
  assigned_agent_id?: string
  cron_expr: string
  timezone?: string
  enabled?: boolean
  overlap_policy?: 'skip' | 'queue' | 'parallel'
  catch_up_policy?: 'none' | 'latest' | 'all'
  delivery_mode?: 'shared_broadcast'
  shared_execution_key?: string
  content_policy?: 'inline_markdown_required'
}

export function normalizeChannelTemplateScheduledTasks(
  tasks: ChannelTemplateScheduledTask[] | undefined,
  defaultAgentId: string,
  createId: () => string,
): ChannelTemplateScheduledTask[] {
  return (tasks ?? []).map((task) => {
    const sharedExecutionKey = task.shared_execution_key?.trim() || ''
    const sharedBroadcast = task.delivery_mode === 'shared_broadcast' && sharedExecutionKey !== ''
    return {
      id: task.id || createId(),
      title: task.title?.trim() || '定时任务',
      description: task.description ?? '',
      assigned_agent_id: task.assigned_agent_id || defaultAgentId,
      cron_expr: task.cron_expr?.trim() || '0 9 * * 1-5',
      timezone: task.timezone?.trim() || 'Asia/Shanghai',
      enabled: task.enabled !== false,
      overlap_policy: task.overlap_policy || 'skip',
      catch_up_policy: task.catch_up_policy || 'latest',
      delivery_mode: sharedBroadcast ? 'shared_broadcast' : undefined,
      shared_execution_key: sharedBroadcast ? sharedExecutionKey : undefined,
      content_policy: sharedBroadcast && task.content_policy === 'inline_markdown_required'
        ? 'inline_markdown_required'
        : undefined,
    }
  })
}

import { ApiError } from '../../core/errors.js'

export interface AgentOption {
  id: string
  name?: string
  role?: string
  version?: string
}

export interface ChannelCreationPolicyResponse {
  can_create: boolean
  reason?: string
  policy?: {
    require_purpose?: boolean
    default_agent_ids?: string[]
  }
  available_agents?: AgentOption[]
}

export type ChannelPolicyLoadStatus = 'idle' | 'loading' | 'loaded' | 'failed'

export function channelPolicyLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return '登录状态已失效，请重新登录后再创建频道。'
      case 403:
        return '当前账号没有权限加载频道策略，请联系管理员检查频道创建设置。'
      case 404:
        return '当前 App 未启用频道策略接口，请联系管理员更新应用。'
      default:
        if (error.message.trim()) return `频道策略暂时不可用：${error.message}`
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return `频道策略暂时不可用：${error.message}`
  }
  return '频道策略暂时不可用，请稍后重试或联系管理员。'
}

export function channelCreationBlockedMessage(reason?: string): string {
  const normalized = reason?.trim()
  switch (normalized) {
    case 'channel creation disabled':
      return '频道创建已关闭，请联系管理员开启。'
    case 'admin only':
      return '仅管理员可以创建频道，请联系管理员协助。'
    case 'owner only':
      return '仅所有者可以创建频道，请联系所有者协助。'
    case 'channel limit reached':
      return '已达到当前账号可创建的频道数量上限。'
    case 'failed to check channel limit':
      return '暂时无法检查频道数量限制，请稍后重试。'
    case '':
    case undefined:
      return '频道创建已关闭，请联系管理员检查设置。'
    default:
      return normalized
  }
}

export function channelAgentPanelState(params: {
  status: ChannelPolicyLoadStatus
  policy: ChannelCreationPolicyResponse | null
  agentCount: number
}) {
  if (params.status === 'loading' || params.status === 'idle') return 'loading'
  if (params.status === 'failed') return 'failed'
  if (!params.policy) return 'failed'
  if (params.agentCount === 0) return 'empty'
  return 'ready'
}

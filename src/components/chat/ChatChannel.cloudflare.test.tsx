import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ChatChannel } from './ChatChannel.js'

vi.mock('../../hooks/use-auth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('../../hooks/use-app-config.js', () => ({
  useAppConfig: () => ({ branding: { title: 'Test', welcomeMessage: 'Hello', inputPlaceholder: '输入消息' } }),
}))

vi.mock('../../hooks/use-channels.js', () => ({
  useChannels: () => ({
    channels: [{ id: 'channel-1', publication_status: 'pending', active_revision: null, settings: '{}' }],
  }),
}))

vi.mock('../../hooks/use-chat.js', () => ({
  useChat: () => ({
    messages: [], streams: [], agentLoops: [], members: [], typings: [],
    send: vi.fn(), sendWithQuote: vi.fn(), submitAnswer: vi.fn(), stopAgent: vi.fn(),
    loading: false, hasOlderMessages: false, loadingOlderMessages: false,
    loadOlderMessages: vi.fn(), loadingAgentRunDetails: false, loadAgentRunDetails: vi.fn(),
  }),
}))

vi.mock('../../hooks/use-detail-panel.js', () => ({
  useDetailPanel: () => ({
    composerInsertText: '', consumeComposerInsert: vi.fn(), insertIntoComposer: vi.fn(),
    openWorkflowRun: vi.fn(), setActiveFeature: vi.fn(), setPanel: vi.fn(),
  }),
}))

vi.mock('../../provider/BeeSeedProvider.js', () => ({
  useBeeSeedContext: () => ({ api: { get: vi.fn() } }),
}))

vi.mock('./MessageList.js', () => ({ MessageList: () => <div data-testid="messages" /> }))
vi.mock('./AgentTodoRail.js', () => ({ AgentTodoRail: () => null }))
vi.mock('./MessageInput.js', () => ({
  MessageInput: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>发送</button>
  ),
}))
vi.mock('./MarkdownImageRendering.js', async () => {
  const { createContext } = await import('react')
  return { markdownImageRendererContext: createContext(undefined) }
})

describe('ChatChannel Cloudflare runtime', () => {
  it('does not block sending on retired ReasonIX publication state', () => {
    const html = renderToStaticMarkup(<ChatChannel channelId="channel-1" />)

    expect(html).toContain('>发送</button>')
    expect(html).not.toContain('disabled=""')
    expect(html).not.toContain('正在准备频道')
    expect(html).not.toContain('频道初始化失败')
  })
})

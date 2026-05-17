// Provider
export { BeeSeedProvider, useBeeSeedContext, type BeeSeedContextValue } from './provider/BeeSeedProvider.js'

// Core types
export type {
  User, Channel, ChannelWithMeta, ChannelMember, ChannelMemberInfo,
  Message, ChatMessage, AgentMeta, AgentConfig,
  WSEvent, WSCommand, AuthResponse, BeeSeedConfig, StreamState,
  AppBrandingConfig, AppRuntimeConfig,
  // Ask-User
  AskUserQuestion, AskUserData,
  // Agent Loop
  AgentLoopToolCallStatus, AgentLoopToolCall, AgentLoopSkillUse, AgentLoopTurn, AgentLoopState,
  // Task System
  Project, Task, TaskComment, TaskSchedule, CalendarEvent,
  // Knowledge Base
  KnowledgeSource, KnowledgeSearchResult, KnowledgeEntity, KnowledgeGraphNode, KnowledgeGraphEdge, KnowledgeGraphData,
  // Storage
  StorageObject,
  // Notifications
  AppNotification,
  // Cron
  CronJob,
  // Channel Memory
  ChannelMemory,
  // Detail Panel
  FeatureView,
} from './core/types.js'

export { ApiError } from './core/errors.js'

// Hooks
export { useAuth } from './hooks/use-auth.js'
export { useConnection } from './hooks/use-connection.js'
export { useChannels } from './hooks/use-channels.js'
export { useChat } from './hooks/use-chat.js'
export { useDetailPanel } from './hooks/use-detail-panel.js'
export { useTasks } from './hooks/use-tasks.js'
export { useKnowledge } from './hooks/use-knowledge.js'
export { useStorage } from './hooks/use-storage.js'
export { useNotifications } from './hooks/use-notifications.js'
export { useCron } from './hooks/use-cron.js'
export { useAgents } from './hooks/use-agents.js'
export { useAppConfig } from './hooks/use-app-config.js'
export { DEFAULT_APP_BRANDING, resolveAppBranding, applyDocumentBranding } from './core/app-config.js'

// Components — Auth
export { LoginForm } from './components/auth/index.js'
export { RegisterForm } from './components/auth/index.js'
export { AuthGuard } from './components/auth/index.js'

// Components — Chat
export { ChatChannel } from './components/chat/index.js'
export { MessageList } from './components/chat/index.js'
export { MessageBubble } from './components/chat/index.js'
export { MessageInput } from './components/chat/index.js'
export { StreamRenderer } from './components/chat/index.js'
export { TypingIndicator } from './components/chat/index.js'
export { MarkdownRenderer } from './components/chat/index.js'
export { ThinkingBlock } from './components/chat/index.js'
export { QuotedMessageBlock } from './components/chat/index.js'
export { ImagePreview } from './components/chat/index.js'
export { ToolGroupBubble } from './components/chat/index.js'
export { AskUserCard } from './components/chat/index.js'
export { MentionMenu } from './components/chat/index.js'
export { AgentLoopTimeline } from './components/chat/index.js'

// Components — Channels
export { ChannelList } from './components/channels/index.js'
export { ChannelItem } from './components/channels/index.js'
export { ChannelHeader } from './components/channels/index.js'
export { CreateChannelDialog } from './components/channels/index.js'

// Components — Layout
export { ChatLayout } from './components/layout/index.js'
export { AppLayout } from './components/layout/index.js'
export { LeftNavSidebar } from './components/layout/index.js'
export { DetailPanel } from './components/layout/index.js'
export { AccordionSection } from './components/layout/index.js'

// Components — Feature Panels
export { TaskPanel } from './components/tasks/index.js'
export { TaskItem } from './components/tasks/index.js'
export { CreateTaskDialog } from './components/tasks/index.js'
export { CreateScheduledTaskDialog } from './components/tasks/index.js'
export { KnowledgePanel } from './components/knowledge/index.js'
export { CloudStoragePanel } from './components/storage/index.js'
export { NotificationList } from './components/notifications/index.js'
export { AgentManagePanel } from './components/agents/index.js'
export { CronPanel } from './components/cron/index.js'

// Components — UI primitives
export { Button, buttonVariants } from './components/ui/index.js'
export { Input } from './components/ui/index.js'
export { Avatar, AvatarImage, AvatarFallback } from './components/ui/index.js'
export { ScrollArea } from './components/ui/index.js'
export { Badge } from './components/ui/index.js'
export { Separator } from './components/ui/index.js'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/index.js'
export { Sheet, SheetHeader, SheetContent } from './components/ui/index.js'
export { Tooltip } from './components/ui/index.js'
export { DropdownMenu, DropdownItem } from './components/ui/index.js'

// Utilities
export { cn } from './lib/cn.js'
export { formatTime, formatBytes } from './lib/format.js'
export { isLikelyFilePath } from './lib/file-path-utils.js'
export { parseMessage } from './stores/messages.js'
export type { CreateScheduledTaskInput, UpdateScheduledTaskInput } from './stores/tasks.js'

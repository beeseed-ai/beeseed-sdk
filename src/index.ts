// Provider
export { BeeSeedProvider, useBeeSeedContext, type BeeSeedContextValue } from './provider/BeeSeedProvider.js'

// Core types
export type {
  User,
  Room,
  RoomWithMeta,
  RoomMember,
  RoomMemberInfo,
  Message,
  ChatMessage,
  AgentMeta,
  AgentConfig,
  WSEvent,
  WSCommand,
  AuthResponse,
  BeeSeedConfig,
  StreamState,
  // Ask-User
  AskUserQuestion,
  AskUserData,
  // Agent Loop
  AgentLoopToolCallStatus,
  AgentLoopToolCall,
  AgentLoopTurn,
  AgentLoopState,
} from './core/types.js'

export { ApiError } from './core/errors.js'

// Hooks
export { useAuth } from './hooks/use-auth.js'
export { useConnection } from './hooks/use-connection.js'
export { useRooms } from './hooks/use-rooms.js'
export { useChat } from './hooks/use-chat.js'

// Components — Auth
export { LoginForm } from './components/auth/index.js'
export { RegisterForm } from './components/auth/index.js'
export { AuthGuard } from './components/auth/index.js'

// Components — Chat
export { ChatRoom } from './components/chat/index.js'
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

// Components — Rooms
export { RoomList } from './components/rooms/index.js'
export { RoomItem } from './components/rooms/index.js'
export { RoomHeader } from './components/rooms/index.js'
export { CreateRoomDialog } from './components/rooms/index.js'

// Components — Layout
export { ChatLayout } from './components/layout/index.js'

// Components — UI primitives
export { Button, buttonVariants } from './components/ui/index.js'
export { Input } from './components/ui/index.js'
export { Avatar, AvatarImage, AvatarFallback } from './components/ui/index.js'
export { ScrollArea } from './components/ui/index.js'

// Utilities
export { cn } from './lib/cn.js'
export { formatTime, formatBytes } from './lib/format.js'
export { isLikelyFilePath } from './lib/file-path-utils.js'

// Store utilities
export { parseMessage } from './stores/messages.js'

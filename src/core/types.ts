// ── User ──

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  role: string
  status: string
  created_at: string
  updated_at: string
}

// ── Room ──

export interface Room {
  id: string
  name: string | null
  avatar_url?: string
  created_by: string
  settings?: string
  created_at: string
  updated_at: string
}

export interface RoomWithMeta extends Room {
  member_count: number
  last_message?: string
  last_msg_at?: string
  unread_count: number
}

// ── Room Member ──

export interface RoomMember {
  id: string
  room_id: string
  member_type: 'user' | 'agent' | 'system'
  user_id?: string
  agent_id?: string
  nickname?: string
  role: 'owner' | 'member' | 'coordinator'
  is_coordinator: boolean
  joined_at: string
}

export interface RoomMemberInfo extends RoomMember {
  display_name: string
  chinese_name?: string
  avatar_url?: string
}

// ── Message (wire format from API/WS) ──

export interface Message {
  id: number
  room_id: string
  sender_type: 'user' | 'agent' | 'system'
  sender_user_id?: string
  sender_agent_id?: string
  content: string
  msg_type: string
  metadata?: Record<string, unknown>
  created_at: string
}

// ── ChatMessage (internal display model, parsed from Message) ──

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  timestamp: number
  msgId?: number
  // Tool fields
  toolName?: string
  toolArgs?: Record<string, unknown>
  toolSuccess?: boolean
  toolDuration?: number
  toolKind?: 'call' | 'result'
  // Sender info
  senderName?: string
  senderAvatarUrl?: string
  senderType?: 'user' | 'agent'
  senderId?: string
  isAgent?: boolean
  // Content variants
  contentType?: string
  isThinking?: boolean
  thinkingContent?: string
  isSlowHint?: boolean
  // Interactive
  askUserData?: AskUserData
  suggestions?: string[]
  // Quoting
  quotedMessage?: { msgId?: number; senderName?: string; content: string }
  // System
  systemSource?: string
  // Routing (multi-agent)
  routingInfo?: { targets: string[]; method: string }
}

// ── Ask-User ──

export interface AskUserQuestion {
  id: string
  type: 'single_select' | 'multi_select' | 'text_input' | 'confirm' | 'image_grid'
  title: string
  description?: string
  required?: boolean
  options?: Array<{ id: string; label: string; description?: string; image_url?: string }>
  placeholder?: string
  multiline?: boolean
  confirm_text?: string
  cancel_text?: string
  columns?: number
  max_select?: number
}

export interface AskUserData {
  questions: AskUserQuestion[]
  status: 'pending' | 'answered'
  answers?: Record<string, unknown>
  askId?: string
  targetUserId?: string
}

// ── Agent Loop ──

export type AgentLoopToolCallStatus = 'calling' | 'success' | 'failed'

export interface AgentLoopToolCall {
  id: string
  name: string
  args?: Record<string, unknown>
  status: AgentLoopToolCallStatus
  output?: string
  startedAt: number
  completedAt?: number
  parallel?: boolean
  batchId?: string
}

export interface AgentLoopTurn {
  turnNumber: number
  thinking?: string
  toolCalls: AgentLoopToolCall[]
  progress?: string
  content?: string
  status: 'active' | 'completed'
  startedAt: number
  completedAt?: number
}

export interface AgentLoopState {
  agentId: string
  roomId: string
  turns: AgentLoopTurn[]
  status: 'running' | 'completed' | 'max_turns_reached' | 'error'
  currentTurn: number
  startedAt: number
  completedAt?: number
  finalContent?: string
  error?: string
}

// ── Agent ──

export interface AgentMeta {
  id: string
  model: string
  provider: string
  created_at: string
}

export interface AgentConfig {
  model: string
  provider: string
  tools: string[]
  temperature: number
}

// ── Streaming state per agent ──

export interface StreamState {
  agentId: string
  content: string
  thinking: string
  toolCall?: { name: string; args?: unknown; status?: AgentLoopToolCallStatus }
  agentLoop?: AgentLoopState
}

// ── WebSocket Events — Server to Client ──

export type WSEvent =
  | { type: 'auth_ok'; user: User; rooms: RoomWithMeta[] }
  | { type: 'message'; room_id: string; message: Message }
  | { type: 'chunk'; room_id: string; agent_id: string; content: string }
  | { type: 'message_end'; room_id: string; agent_id: string; message: Message }
  | { type: 'thinking'; room_id: string; agent_id: string; content: string }
  | { type: 'thinking_content'; room_id: string; agent_id: string; content: string }
  | { type: 'tool_call'; room_id: string; agent_id: string; name: string; args?: unknown; batch_id?: string; parallel?: boolean }
  | { type: 'tool_result'; room_id: string; agent_id: string; name: string; success?: boolean; output?: string; duration_secs?: number }
  | { type: 'error'; room_id?: string; agent_id?: string; error: string }
  // Agent Loop events
  | { type: 'agent_ack'; room_id: string; agent_id: string; turn: number; content?: string }
  | { type: 'agent_thinking'; room_id: string; agent_id: string; turn: number; content?: string }
  | { type: 'agent_progress'; room_id: string; agent_id: string; turn: number; summary: string }
  | { type: 'agent_done'; room_id: string; agent_id: string; turn: number; content: string }
  | { type: 'max_turns_reached'; room_id: string; agent_id: string; turn: number }

// ── WebSocket Commands — Client to Server ──

export type WSCommand =
  | { type: 'message'; room_id: string; content: string; msg_type?: string; metadata?: Record<string, unknown> }
  | { type: 'join_room'; room_id: string }
  | { type: 'leave_room'; room_id: string }
  | { type: 'read_ack'; room_id: string; msg_id: number }
  | { type: 'ask_user_answer'; room_id: string; ask_id: string; answers: Record<string, unknown> }

// ── Auth ──

export interface AuthResponse {
  user: User
  token: string
}

// ── SDK Configuration ──

export interface BeeSeedConfig {
  workerUrl: string
  tokenKey?: string
  onAuthError?: () => void
}

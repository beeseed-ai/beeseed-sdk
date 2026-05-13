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

// ── App User Management ──

export type AppRole = 'owner' | 'admin' | 'member'
export type RegistrationPolicy = 'open' | 'invite' | 'closed'

export interface AppUser {
  id: string
  email: string
  name: string
  avatar_url?: string
  role: AppRole
  is_disabled: boolean
  created_at: string
  updated_at: string
}

export interface Invite {
  id: string
  token_prefix: string
  code?: string
  note?: string | null
  created_by: string
  created_at: string
  expires_at?: string | null
  used_at?: string | null
  used_by?: string | null
  revoked_at?: string | null
  revoked_by?: string | null
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
  status: 'running' | 'completed' | 'max_turns_reached' | 'error' | 'stopped' | 'interrupted'
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
  display_name?: string
  avatar_url?: string
  status?: string
  created_at: string
}

export interface AgentConfig {
  model: string
  provider: string
  tools: string[]
  temperature: number
  system_prompt?: string
  identity?: string
}

// ── Task System ──

export interface Project {
  id: string
  room_id: string
  title: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  created_by?: string
  created_at: string
  updated_at: string
  task_count?: number
  done_count?: number
}

export interface Task {
  id: string
  room_id: string
  project_id?: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'blocked'
  assigned_type?: 'user' | 'agent'
  assigned_user_id?: string
  assigned_agent_id?: string
  assigned_name?: string
  priority: number
  due_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface TaskComment {
  id: number
  task_id: string
  author_type: 'user' | 'agent' | 'system'
  author_id?: string
  content: string
  comment_type: 'comment' | 'progress' | 'result' | 'system'
  created_at: string
}

// ── Knowledge Base ──

export interface KnowledgeSource {
  id: number
  title: string
  source_type: 'file_upload' | 'chat_distillation'
  file_key?: string
  file_size: number
  mime_type?: string
  status: 'pending' | 'processing' | 'ready' | 'error'
  error_message?: string
  summary?: string
  chunk_count: number
  tags: string[]
  created_by?: string
  created_at: string
}

export interface KnowledgeSearchResult {
  chunk_id: number
  content: string
  similarity: number
  source_id: number
  source_title: string
}

export interface KnowledgeEntity {
  id: number
  name: string
  entity_type: string
  description?: string
  aliases: string[]
  mention_count: number
}

export interface KnowledgeGraphNode {
  id: string
  node_type: 'source' | 'entity'
  title: string
  entity_type?: string
  tags?: string[]
  chunk_count?: number
}

export interface KnowledgeGraphEdge {
  source: string
  target: string
  weight: number
  type: string
  description?: string
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
}

// ── Storage ──

export interface StorageObject {
  id?: string
  key: string
  name?: string
  size: number
  last_modified: string
  content_type: string
  status?: string
}

export interface StoragePolicy {
  enabled: boolean
  visibility: 'room' | 'shared'
  members_can_upload: boolean
  members_can_delete_own: boolean
}

// ── Notifications ──

export interface AppNotification {
  id: number
  user_id: string
  type: string
  title: string
  content?: string
  metadata?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

// ── Cron Jobs ──

export interface CronJob {
  id: string
  room_id: string
  cron_expr: string
  message: string
  timezone: string
  enabled: boolean
  last_run?: string
  created_by?: string
  created_at: string
}

// ── Room Memory ──

export interface RoomMemory {
  id: number
  room_id: string
  content: string
  category: string
  priority: string
  importance: number
  entities: string[]
  topics: string[]
  created_at: string
  expires_at?: string
}

// ── Detail Panel ──

export type FeatureView = 'chat' | 'tasks' | 'knowledge' | 'storage' | 'agents' | 'cron' | 'settings' | 'admin'

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
  | { type: 'agent_stopped'; room_id: string; agent_id: string; turn?: number }
  // UI events
  | { type: 'routing_info'; room_id: string; routing_info: { routing_method: string; target_agent_ids: string[]; reason: string } }
  | { type: 'typing'; room_id: string; agent_id?: string }

// ── WebSocket Commands — Client to Server ──

export type WSCommand =
  | { type: 'message'; room_id: string; content: string; msg_type?: string; metadata?: Record<string, unknown> }
  | { type: 'join_room'; room_id: string }
  | { type: 'leave_room'; room_id: string }
  | { type: 'read_ack'; room_id: string; msg_id: number }
  | { type: 'ask_user_answer'; room_id: string; ask_id: string; answers: Record<string, unknown> }
  | { type: 'stop_agent'; room_id: string; agent_id: string }

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
  useMockData?: boolean
}

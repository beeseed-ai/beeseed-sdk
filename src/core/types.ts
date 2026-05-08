// User
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

// Room
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

// Room Member
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

// Message
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

// Agent
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

// WebSocket Events — Server to Client
export type WSEvent =
  | { type: 'auth_ok'; user: User; rooms: RoomWithMeta[] }
  | { type: 'message'; room_id: string; message: Message }
  | { type: 'chunk'; room_id: string; agent_id: string; content: string }
  | { type: 'message_end'; room_id: string; agent_id: string; message: Message }
  | { type: 'thinking'; room_id: string; agent_id: string; content: string }
  | { type: 'tool_call'; room_id: string; agent_id: string; name: string; args?: unknown }
  | { type: 'tool_result'; room_id: string; agent_id: string; name: string; success?: boolean; output?: string }
  | { type: 'error'; room_id?: string; agent_id?: string; error: string }

// WebSocket Commands — Client to Server
export type WSCommand =
  | { type: 'message'; room_id: string; content: string; msg_type?: string }
  | { type: 'join_room'; room_id: string }
  | { type: 'leave_room'; room_id: string }
  | { type: 'read_ack'; room_id: string; msg_id: number }

// Auth
export interface AuthResponse {
  user: User
  token: string
}

// SDK Configuration
export interface BeeSeedConfig {
  workerUrl: string
  tokenKey?: string
  onAuthError?: () => void
}

// Streaming state per agent
export interface StreamState {
  agentId: string
  content: string
  thinking: string
  toolCall?: { name: string; args?: unknown }
}

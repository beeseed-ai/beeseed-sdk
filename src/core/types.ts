// ── User ──

export interface User {
  id: string
  email: string
  phone?: string
  phone_verified_at?: string
  name: string
  avatar_url?: string
  role: string
  status: string
  app_user_id?: string
  app_membership_status?: AppMembershipStatus
  created_at: string
  updated_at: string
}

export interface HiveProfileSnapshot {
  id: string
  name?: string
  avatar_url?: string | null
  email?: string | null
  email_verified_at?: string | null
  phone?: string | null
  phone_verified_at?: string | null
  updated_at?: string
  profile_version?: number
}

// ── App User Management ──

export type AppRole = 'owner' | 'admin' | 'member'
export type RegistrationPolicy = 'open' | 'invite' | 'closed'
export type AppMembershipStatus = 'active' | 'disabled' | 'pending' | 'left'
export type ApplicationEntryMode = 'public' | 'org_only' | 'invite_only' | 'closed'
export type ApplicationJoinMode = 'auto' | 'invite' | 'approval' | 'closed'

export interface ApplicationAccessPolicy {
  app_id?: string
  entry_mode: ApplicationEntryMode
  join_mode: ApplicationJoinMode
  allow_new_hive_users: boolean
  profile_scope?: Record<string, boolean>
  updated_at?: string
}

export interface AppUser {
  id: string
  email: string
  name: string
  avatar_url?: string
  role: AppRole
  is_disabled: boolean
  app_user_id?: string
  app_membership_status?: AppMembershipStatus
  created_at: string
  updated_at: string
}

export interface AppMemberBlock {
  id: string
  app_id: string
  user_id: string
  app_user_id?: string
  reason?: string
  blocked_by?: string | null
  blocked_at: string
  revoked_by?: string | null
  revoked_at?: string | null
  user_name?: string
  user_email?: string
  user_avatar?: string | null
}

export interface Invite {
  id: string
  token_prefix: string
  code?: string
  invite_url?: string
  note?: string | null
  created_by?: string | null
  created_at: string
  expires_at?: string | null
  used_at?: string | null
  used_by?: string | null
  revoked_at?: string | null
  revoked_by?: string | null
}

// ── Channel ──

export interface Channel {
  id: string
  name: string | null
  avatar_url?: string
  created_by: string
  settings?: string
  created_at: string
  updated_at: string
  archived_at?: string | null
  archived_by?: string | null
  deleted_at?: string | null
  deleted_by?: string | null
  delete_reason?: string | null
}

export interface ChannelWithMeta extends Channel {
  member_count: number
  last_message?: string
  last_msg_at?: string
  unread_count: number
  owner_name?: string
  owner_email?: string
}

export interface ChannelRuntimeSettings {
  welcome_title?: string
  welcome_message?: string
  quick_questions?: string[]
}

// ── Channel Member ──

export interface ChannelMember {
  id: string
  channel_id: string
  member_type: 'user' | 'agent' | 'system'
  user_id?: string
  agent_id?: string
  nickname?: string
  role: 'owner' | 'admin' | 'member' | 'coordinator'
  is_coordinator: boolean
  ext_info?: Record<string, unknown> | string
  joined_at: string
}

export interface ChannelMemberInfo extends ChannelMember {
  display_name: string
  chinese_name?: string
  avatar_url?: string
}

// ── Message (wire format from API/WS) ──

export interface Message {
  id: number
  channel_id: string
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
  agentRunId?: string
  isAgent?: boolean
  // Content variants
  contentType?: string
  isThinking?: boolean
  thinkingContent?: string
  isSlowHint?: boolean
  // Interactive
  askUserData?: AskUserData
  askUserAnswerData?: AskUserAnswerData
  suggestions?: string[]
  // Quoting
  quotedMessage?: { msgId?: number; senderName?: string; content: string }
  // System
  systemSource?: string
  workflowTarget?: {
    workflowId?: string
    runId: string
    nodeRunId?: string
    event?: string
  }
  // Routing (multi-agent)
  routingInfo?: { targets: string[]; method: string }
  // Explicit skill intents selected by the user before sending.
  selectedSkills?: SelectedSkillIntent[]
}

// ── Skill Shortcut ──

export interface SkillShortcutAgent {
  agent_id: string
  agent_name: string
}

export interface SkillShortcutOption {
  name: string
  display_name?: string
  description?: string
  icon_url?: string
  agents?: SkillShortcutAgent[]
  source?: 'agent' | 'recent' | 'general'
}

export interface SelectedSkillIntent {
  skill_id: string
  skill_name: string
  skill_display_name?: string
  skill_description?: string
  skill_icon_url?: string
  agent_id: string
  agent_name: string
  source?: 'skill_button' | 'slash' | 'trigger'
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
  status: 'pending' | 'answered' | 'expired'
  answers?: Record<string, unknown>
  askId?: string
  targetUserId?: string
  targetUserIds?: string[]
  visibility?: 'target_user' | 'target_users' | 'mentioned_users' | 'channel_admins' | 'all_members'
  expiresAt?: string
  skillEnableRequest?: {
    skill?: string
    displayName?: string
    description?: string
    reason?: string
    agentId?: string
    agentName?: string
  }
}

export interface AskUserAnswerData {
  askId?: string
  targetAgentId?: string
  targetAgentName?: string
  answers?: Record<string, unknown>
}

// ── Agent Loop ──

export type AgentLoopToolCallStatus = 'calling' | 'success' | 'failed'
export type AgentTodoStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped'

export interface AgentTodoItem {
  id: string
  title: string
  status: AgentTodoStatus
  seq: number
  evidence?: string
  blocker?: string
  updated_at?: string
  completed_at?: string
}

export interface AgentLoopToolCall {
  id: string
  toolCallId?: string
  seq?: number
  name: string
  args?: Record<string, unknown>
  status: AgentLoopToolCallStatus
  output?: string
  startedAt: number
  completedAt?: number
  parallel?: boolean
  batchId?: string
}

export interface AgentLoopSkillUse {
  id: string
  seq?: number
  name: string
  displayName?: string
  description?: string
  iconUrl?: string
  status: 'available' | 'suggested' | 'approved' | 'triggered' | 'injected' | 'missing' | 'error'
  reason?: string
  startedAt: number
}

export interface AgentLoopTurn {
  turnNumber: number
  thinking?: string
  toolCalls: AgentLoopToolCall[]
  skillUses: AgentLoopSkillUse[]
  progress?: string
  content?: string
  status: 'active' | 'completed'
  startedAt: number
  completedAt?: number
}

export type AgentLoopEventType = 'assistant_content' | 'progress' | 'skill_use' | 'tool_call' | 'tool_result'

export interface AgentLoopEventItem {
  id: string
  seq?: number
  messageId?: number
  type: AgentLoopEventType
  turnNumber: number
  timestamp: number
  content?: string
  summary?: string
  skill?: AgentLoopSkillUse
  tool?: AgentLoopToolCall
}

export interface AgentLoopState {
  runId?: string
  agentId: string
  channelId: string
  turns: AgentLoopTurn[]
  status: 'running' | 'completed' | 'max_turns_reached' | 'error' | 'stopped' | 'interrupted' | 'waiting_for_user' | 'waiting_expired'
  currentTurn: number
  startedAt: number
  completedAt?: number
  finalContent?: string
  error?: string
  todos?: AgentTodoItem[]
  events?: AgentLoopEventItem[]
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
  model_tier?: ModelTierName | ''
  model_tiers?: ModelTierSettings
  tools: string[]
  temperature: number
  system_prompt?: string
  identity?: string
}

export type ModelTierName = 'fast' | 'thinking' | 'pro'

export interface ModelTierConfig {
  provider: string
  model: string
  thinking: boolean
}

export interface ModelTierSettings {
  default_tier: ModelTierName
  tiers: Record<ModelTierName, ModelTierConfig>
}

// ── Task System ──

export interface Project {
  id: string
  channel_id: string
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
  channel_id: string
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
  result?: string
  started_at?: string
  completed_at?: string
  failure_code?: string
  failure_detail?: string
  verification_status?: 'none' | 'pending' | 'accepted' | 'rejected'
  verified_by?: string
  verified_at?: string
  agent_completed_at?: string
  scheduler_state?: 'manual' | 'template' | 'waiting_time' | 'pending_deps' | 'ready' | 'dispatched' | 'awaiting_verify' | 'verified' | 'failed' | 'cancelled'
  scheduled_start_at?: string
  deadline_at?: string
  dispatched_at?: string
  retry_count?: number
  max_retries?: number
  schedule_id?: string
  parent_task_id?: string
  occurrence_at?: string
  depends_on_task_ids?: string[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface TaskSchedulerMetrics {
  total: number
  open: number
  ready: number
  dispatched: number
  awaiting_verify: number
  overdue: number
  pending_deps: number
  waiting_time: number
  failed: number
  failed_24h: number
  blocked: number
  retried: number
  schedules_enabled: number
  schedules_due: number
  avg_dispatch_seconds?: number
  failure_codes: Record<string, number>
  by_scheduler_state: Record<string, number>
  by_status: Record<string, number>
  agent_busy_count: number
  busy_agent_keys?: string[]
  updated_at: string
}

export interface TaskSchedule {
  id: string
  channel_id: string
  task_template_id?: string
  kind: 'once' | 'recurring'
  timezone: string
  run_at?: string
  recurrence_rule?: string
  next_fire_at?: string
  last_fire_at?: string
  enabled: boolean
  overlap_policy: 'skip' | 'queue' | 'parallel'
  catch_up_policy: 'none' | 'latest' | 'all'
  template_title?: string
  template_description?: string
  assigned_agent_id?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  type: 'task' | 'projected_occurrence'
  title: string
  start_at: string
  status: string
  task_id?: string
  schedule_id?: string
  occurrence_at?: string
  is_recurring: boolean
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

export interface KnowledgeBase {
  id: string
  scope_type: 'platform' | 'organization' | 'app' | 'channel'
  organization_id?: string
  app_id?: string
  channel_id?: string
  name: string
  display_name: string
  description?: string
  icon?: string
  category?: string
  version?: string
  tags: string[]
  source_count: number
  chunk_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface KnowledgeSubscription {
  id: string
  app_id: string
  organization_id: string
  knowledge_base_id: string
  subscribed_by?: string
  subscribed_at: string
  knowledge_base: KnowledgeBase
}

export interface KnowledgeSource {
  id: number
  organization_id?: string
  knowledge_base_id?: string
  channel_id?: string
  title: string
  source_type: string
  origin_type?: string
  origin_ref?: string
  file_key?: string
  file_size: number
  mime_type?: string
  status: 'pending' | 'processing' | 'ready' | 'error' | 'failed'
  error_message?: string
  summary?: string
  chunk_count: number
  processing_stage?: string
  processing_progress?: number
  processing_message?: string
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
  display_name?: string
  size: number
  last_modified: string
  content_type: string
  status?: string
}

export interface StoragePolicy {
  enabled: boolean
  visibility: 'channel' | 'shared'
  members_can_upload: boolean
  members_can_delete_own: boolean
}

export interface StorageUsage {
  objects: number
  bytes: number
}

// ── Notifications ──

export interface AppNotification {
  id: number
  user_id: string
  type: string
  title: string
  content?: string
  metadata?: Record<string, unknown>
  action_type?: string
  action_status?: 'pending' | 'accepted' | 'declined' | 'cancelled'
  actor_user_id?: string
  is_read: boolean
  acted_at?: string
  created_at: string
}

// ── Cron Jobs ──

export interface CronJob {
  id: string
  channel_id: string
  cron_expr: string
  message: string
  timezone: string
  enabled: boolean
  last_run?: string
  created_by?: string
  created_at: string
}

// ── Workflows ──

export type WorkflowStatus = 'draft' | 'enabled' | 'disabled' | 'archived'
export type WorkflowRunStatus = 'queued' | 'running' | 'awaiting_user' | 'succeeded' | 'failed' | 'cancelled'
export type WorkflowNodeRunStatus = 'pending' | 'ready' | 'running' | 'awaiting_user' | 'succeeded' | 'failed' | 'skipped' | 'cancelled'
export type WorkflowNodeType = 'trigger' | 'task' | 'condition' | 'human_approval' | 'end'
export type WorkflowExecutorType = 'agent' | 'user' | 'human' | 'system'

export interface WorkflowPort {
  key: string
  label: string
  schema?: Record<string, unknown>
  required?: boolean
}

export interface WorkflowExecutor {
  type: WorkflowExecutorType
  ref?: string
  prompt_template?: string
  config?: Record<string, unknown>
}

export interface WorkflowGraphNode {
  id: string
  key: string
  type: WorkflowNodeType
  title: string
  description?: string
  condition_mode?: 'llm' | 'rule'
  condition_model?: string
  condition_prompt?: string
  condition_selection?: 'single' | 'multiple'
  condition_fallback?: 'default' | 'fail'
  condition_confidence_threshold?: number
  inputs?: WorkflowPort[]
  outputs?: WorkflowPort[]
  input_mapping?: Record<string, string>
  output_mapping?: Record<string, string>
  executor?: WorkflowExecutor
  trigger_condition?: Record<string, unknown>
  retry_policy?: Record<string, unknown>
  timeout_seconds?: number
  require_user_verification?: boolean
  ui?: { position?: { x: number; y: number } }
}

export interface WorkflowGraphEdge {
  id: string
  source: string
  target: string
  source_handle?: string
  target_handle?: string
  condition?: Record<string, unknown>
  branch_description?: string
  data_mapping?: Record<string, string>
  on_failure?: 'block' | 'skip' | 'continue'
}

export interface WorkflowGraph {
  schema_version: number
  nodes: WorkflowGraphNode[]
  edges: WorkflowGraphEdge[]
  variables?: Record<string, unknown>
}

export interface Workflow {
  id: string
  channel_id: string
  name: string
  description: string
  status: WorkflowStatus
  active_version_id?: string
  source_template_id?: string
  source_template_version_id?: string
  settings: Record<string, unknown> | string
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface WorkflowTemplate {
  id: string
  scope_type: 'platform' | 'organization' | 'app'
  organization_id?: string
  app_id?: string
  template_key: string
  display_name: string
  description: string
  category: string
  visibility: 'public' | 'private'
  status: 'draft' | 'published' | 'archived'
  current_version_id?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface WorkflowTemplateVersion {
  id: string
  template_id: string
  version: string
  graph_json: WorkflowGraph
  variable_schema: Record<string, unknown>
  required_bindings: Record<string, unknown>
  default_triggers: Array<Record<string, unknown>>
  sample_inputs: Array<Record<string, unknown>>
  content_hash: string
  review_status: 'draft' | 'published' | 'archived'
  created_by?: string
  published_at?: string
  created_at: string
}

export interface WorkflowTemplateImportPayload {
  template: WorkflowTemplate
  version: WorkflowTemplateVersion
  workflow: {
    name: string
    description: string
    graph_json: WorkflowGraph
    settings: Record<string, unknown>
  }
}

export interface WorkflowVersion {
  id: string
  workflow_id: string
  version_no: number
  graph_json: WorkflowGraph
  input_schema: Record<string, unknown>
  output_schema: Record<string, unknown>
  validation_status: 'valid' | 'invalid'
  validation_errors: WorkflowValidationError[]
  content_hash: string
  published_by?: string
  published_at?: string
  created_at: string
}

export interface WorkflowTrigger {
  id: string
  workflow_id: string
  channel_id: string
  type: 'manual' | 'message' | 'schedule' | 'task_event' | 'storage_event' | 'webhook'
  enabled: boolean
  condition_json: Record<string, unknown>
  schedule_rule: string
  timezone: string
  concurrency_policy: 'skip' | 'queue' | 'parallel'
  cooldown_seconds: number
  webhook_secret?: string
  webhook_secret_prefix?: string
  last_triggered_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface WorkflowRun {
  id: string
  channel_id: string
  workflow_id: string
  workflow_version_id: string
  trigger_id?: string
  trigger_type: string
  trigger_ref: string
  idempotency_key: string
  status: WorkflowRunStatus
  input_payload: Record<string, unknown>
  output_payload: Record<string, unknown>
  failure_code: string
  failure_detail: string
  created_by?: string
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface WorkflowNodeRun {
  id: string
  run_id: string
  node_id: string
  node_key: string
  node_type: WorkflowNodeType
  executor_type: WorkflowExecutorType
  executor_ref: string
  status: WorkflowNodeRunStatus
  input_payload: Record<string, unknown>
  output_payload: Record<string, unknown>
  task_id?: string
  attempts: number
  failure_code: string
  failure_detail: string
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface WorkflowNodeRunEvent {
  id: number
  run_id: string
  node_run_id?: string
  event_type: string
  message: string
  payload: Record<string, unknown>
  created_at: string
}

export interface WorkflowApproval {
  id: string
  channel_id: string
  run_id: string
  node_run_id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'
  approver_scope: Record<string, unknown>
  requested_by?: string
  acted_by?: string
  prompt: string
  decision_note: string
  expires_at?: string
  acted_at?: string
  created_at: string
  updated_at: string
}

export interface WorkflowValidationError {
  code: string
  message: string
  node_id?: string
  edge_id?: string
  severity: string
}

export interface WorkflowMetrics {
  active_runs: number
  queued_runs: number
  awaiting_user_runs: number
  succeeded_24h: number
  failed_24h: number
  cancelled_24h: number
  stuck_node_runs: number
  avg_run_seconds?: number
  avg_node_seconds?: number
  failure_codes: Record<string, number>
  by_run_status: Record<string, number>
  by_node_status: Record<string, number>
  lease_expired_count: number
  message_triggers_suppressed: number
  updated_at: string
}

// ── Channel Memory ──

export interface ChannelMemory {
  id: number
  channel_id: string
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

export type FeatureView = 'chat' | 'tasks' | 'workflows' | 'knowledge' | 'storage' | 'cron' | 'settings' | 'admin'

// ── Streaming state per agent ──

export interface StreamState {
  agentId: string
  runId?: string
  content: string
  thinking: string
  toolCall?: { name: string; args?: unknown; status?: AgentLoopToolCallStatus }
  agentLoop?: AgentLoopState
}

// ── WebSocket Events — Server to Client ──

export type AgentLoopWireFields = { seq?: number; event_id?: string; tool_call_id?: string }

export type WSEvent =
  | { type: 'auth_ok'; user: User; channels: ChannelWithMeta[] }
  | { type: 'message'; channel_id: string; message: Message }
  | ({ type: 'chunk'; channel_id: string; agent_id: string; run_id?: string; content: string; turn?: number } & AgentLoopWireFields)
  | ({ type: 'message_end'; channel_id: string; agent_id: string; run_id?: string; turn?: number; message: Message } & AgentLoopWireFields)
  | ({ type: 'thinking'; channel_id: string; agent_id: string; run_id?: string; content: string } & AgentLoopWireFields)
  | ({ type: 'thinking_content'; channel_id: string; agent_id: string; run_id?: string; content: string } & AgentLoopWireFields)
  | ({ type: 'tool_call'; channel_id: string; agent_id: string; run_id?: string; name: string; args?: unknown; batch_id?: string; parallel?: boolean; turn?: number } & AgentLoopWireFields)
  | ({ type: 'tool_result'; channel_id: string; agent_id: string; run_id?: string; name: string; success?: boolean; output?: string; duration_secs?: number; turn?: number } & AgentLoopWireFields)
  | ({ type: 'skill_use'; channel_id: string; agent_id: string; run_id?: string; name: string; display_name?: string; description?: string; icon_url?: string; status?: AgentLoopSkillUse['status']; reason?: string; turn?: number } & AgentLoopWireFields)
  | ({ type: 'error'; channel_id?: string; agent_id?: string; run_id?: string; error: string; turn?: number } & AgentLoopWireFields)
  // Agent Loop events
  | ({ type: 'agent_ack'; channel_id: string; agent_id: string; run_id?: string; turn: number; content?: string } & AgentLoopWireFields)
  | ({ type: 'agent_turn_start'; channel_id: string; agent_id: string; run_id?: string; turn: number } & AgentLoopWireFields)
  | ({ type: 'agent_thinking'; channel_id: string; agent_id: string; run_id?: string; turn: number; content?: string } & AgentLoopWireFields)
  | ({ type: 'agent_progress'; channel_id: string; agent_id: string; run_id?: string; turn: number; summary: string } & AgentLoopWireFields)
  | ({ type: 'agent_todo_snapshot'; channel_id: string; agent_id: string; run_id?: string; turn?: number; todo?: AgentTodoItem; todos: AgentTodoItem[] } & AgentLoopWireFields)
  | ({ type: 'agent_todo_updated'; channel_id: string; agent_id: string; run_id?: string; turn?: number; todo?: AgentTodoItem; todos?: AgentTodoItem[] } & AgentLoopWireFields)
  | ({ type: 'agent_waiting_user'; channel_id: string; agent_id: string; run_id?: string; turn: number; summary: string } & AgentLoopWireFields)
  | ({ type: 'agent_ask_user_expired'; channel_id: string; agent_id: string; run_id?: string; turn: number; summary: string } & AgentLoopWireFields)
  | ({ type: 'agent_done'; channel_id: string; agent_id: string; run_id?: string; turn: number; content: string } & AgentLoopWireFields)
  | ({ type: 'max_turns_reached'; channel_id: string; agent_id: string; run_id?: string; turn: number } & AgentLoopWireFields)
  | ({ type: 'agent_stopped'; channel_id: string; agent_id: string; run_id?: string; turn?: number; summary?: string } & AgentLoopWireFields)
  // Local Agent / External Agent runtime events
  | ({ type: 'local_agent.run.started' | 'local_agent.run.progress' | 'local_agent.run.question' | 'local_agent.run.artifacts.ready' | 'local_agent.run.artifacts.uploaded'; channel_id: string; agent_id?: string; device_id?: string; run_id: string; capability?: string; status?: string; output?: unknown; error?: unknown } & AgentLoopWireFields)
  | ({ type: 'local_agent.run.succeeded' | 'local_agent.run.failed'; channel_id: string; agent_id?: string; device_id?: string; run_id: string; capability?: string; status?: string; output?: unknown; error?: unknown } & AgentLoopWireFields)
  // UI events
  | { type: 'routing_info'; channel_id: string; routing_info: { routing_method: string; target_agent_ids: string[]; reason: string } }
  | { type: 'channels_updated'; channel_id?: string }
  | { type: 'notification'; notification: AppNotification }
  | { type: 'kicked'; reason?: string }
  | { type: 'typing'; channel_id: string; agent_id?: string; run_id?: string }
  | { type: 'task_updated'; channel_id: string; task: Task }
  | { type: 'workflow_updated'; channel_id: string; workflow_id: string }
  | { type: 'workflow_run_updated'; channel_id: string; run: WorkflowRun }
  | { type: 'workflow_node_run_updated'; channel_id: string; run_id: string; node_run: WorkflowNodeRun }
  | { type: 'workflow_run_event'; channel_id: string; run_id: string; event: WorkflowNodeRunEvent }

// ── WebSocket Commands — Client to Server ──

export type WSCommand =
	| { type: 'message'; channel_id: string; content: string; msg_type?: string; metadata?: Record<string, unknown> }
	| { type: 'join_channel'; channel_id: string }
	| { type: 'leave_channel'; channel_id: string }
	| { type: 'read_ack'; channel_id: string; msg_id: number }
	| { type: 'ask_user_answer'; channel_id: string; ask_id: string; answers: Record<string, unknown> }
	| { type: 'stop_agent'; channel_id: string; agent_id: string; run_id?: string; reason?: string }

// ── Auth ──

export interface AuthResponse {
  user: User
  token: string
}

// ── SDK Configuration ──

export interface AppBrandingConfig {
  title?: string
  pageTitle?: string
  logo?: string
  favicon?: string
  description?: string
  welcomeMessage?: string
  inputPlaceholder?: string
}

export type PublicHomeTemplateID = 'ai_workspace' | 'education' | 'consulting' | 'community' | 'creative'

export interface PublicHomeTextBlock {
  title: string
  description?: string
}

export interface PublicHomeMetric {
  value: string
  label: string
}

export interface PublicHomeConfig {
  enabled?: boolean
  template?: PublicHomeTemplateID
  eyebrow?: string
  title?: string
  subtitle?: string
  cover_image_url?: string
  primary_cta?: string
  secondary_cta?: string
  features?: string[]
  audiences?: string[]
  capabilities?: PublicHomeTextBlock[]
  workflow?: PublicHomeTextBlock[]
  metrics?: PublicHomeMetric[]
  closing_title?: string
  closing_subtitle?: string
}

export interface AppRuntimeConfig {
  branding?: AppBrandingConfig
  public_home?: PublicHomeConfig
  theme?: Record<string, unknown>
  features?: Record<string, unknown>
  layout?: Record<string, unknown>
  customCSS?: string
  platform?: {
    external_url?: string
    app_domain?: string
    subdomain?: string
  }
}

export interface BeeSeedConfig {
  workerUrl: string
  tokenKey?: string
  onSignOut?: (options?: SignOutOptions) => void
  onAuthError?: () => void
  useMockData?: boolean
  appConfig?: AppRuntimeConfig
}

export interface SignOutOptions {
  scope?: 'local' | 'global'
}

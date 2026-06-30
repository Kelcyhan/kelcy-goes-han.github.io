// --- Content blocks ---

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | unknown[]
  is_error?: boolean
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock

// --- Messages ---

export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export type MessageSubtype = 'hook' | 'local_command' | 'task_notification' | 'system_prompt' | 'agent_message' | 'interrupt'

export interface Message {
  uuid: string
  type: 'user' | 'assistant'
  timestamp: string
  content: ContentBlock[]
  model?: string
  usage?: Usage
  permissionMode?: string
  isMeta?: boolean
  subtype?: MessageSubtype
}

// --- Sessions ---

export type SessionStatus = 'working' | 'idle' | 'unknown' | 'ended' | 'waiting_input' | 'login_required'

export interface Session {
  name: string
  working_dir?: string
  vault_root?: string | null
  jsonl_path?: string | null
  status?: string
  turns?: number
  mtime?: number | string | null
  final_message?: string
  tools_used?: string[]
  files_changed?: string[]
  agent_role?: string | null
  task_title?: string | null
  task_id?: string | null
  orchestrator_session?: string | null
  shadow_session?: string | null
  task_path?: string | null
  runtime?: string | null
  model?: string | null
  total_input_tokens?: number
  total_output_tokens?: number
  login_provider?: 'claude' | 'codex' | null
  login_failure_id?: string | null
  display_name?: string | null
  wrapup_started_at?: string | null
}

// --- Past Agents ---

export interface PastAgent {
  name: string
  session_id: string
  role: string
  project_id: string | null
  task_id: string | null
  task_title: string | null
  ended: string
  outcome: string
  task_status: string
  jsonl_path: string | null
  working_dir: string | null
  next_step: string | null
  summary: string | null
  files_changed: string[]
  errors: string | null
  goal_impact: string | null
  // Shadow card data (from dead session cards — persists after session death)
  shadow_glance: string | null
  shadow_summary: string | null
  shadow_status: string | null
  shadow_progress: string[] | null
  // Receipt-sourced fields (present when session emitted a wrapup receipt)
  display_title?: string | null
  deliverables?: { path: string; desc: string }[]
}

// --- Session Cards (shadow agent summaries) ---

export interface SessionCard {
  glance: string
  summary: string
  status: string
  progress: string[]
  files_edited: string[]
  tools_used: string[]
  task: string
  last_updated: string
}

// --- Turn grouping ---

export interface Turn {
  userMsg: Message | null
  steps: Message[]
  finalMsg: Message | null
}

// --- Vault ---

export interface VaultFile {
  path: string
  name: string
  frontmatter: Record<string, unknown>
  body: string
}

export interface TreeNode {
  type: 'dir' | 'file'
  name: string
  path: string
  children?: TreeNode[]
}

// --- Notifications ---

export interface Notification {
  id: string
  session_name: string
  display_name?: string
  message: string
  urgency?: 'normal' | 'urgent'
  timestamp: number | string
}

// --- WebSocket message types ---

export interface WsMessagesPayload {
  type: 'messages'
  messages: Message[]
  last_uuid: string
  model?: string
}

export interface WsStatusPayload {
  type: 'status'
  status: string
  turns?: number
  model?: string
  total_usage?: {
    input_tokens: number
    output_tokens: number
  }
}

export interface WsSessionEndedPayload {
  type: 'session_ended'
}

export interface WsConversationResetPayload {
  type: 'conversation_reset'
}

export type WsPayload = WsMessagesPayload | WsStatusPayload | WsSessionEndedPayload | WsConversationResetPayload

import type { Session, Message, VaultFile, TreeNode, Notification } from './types.ts'
import {
  fetchLocalChildren,
  fetchLocalMessages,
  fetchLocalMtime,
  fetchLocalPMProjects,
  fetchLocalPMState,
  fetchLocalSessions,
  fetchLocalUserTasks,
  fetchLocalVaultDirectory,
  fetchLocalVaultFile,
  fetchLocalVaultTree,
  hasLocalVault,
  resolveLocalTaskPath,
  resolveLocalWikilink,
  saveLocalVaultFile,
  searchLocalVaultDirs,
  searchLocalVaultFiles,
} from './local-vault.ts'

const AUTH_TOKEN = new URLSearchParams(window.location.search).get('token') || ''

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
  return headers
}

export function getAuthToken(): string {
  return AUTH_TOKEN
}

async function parseApiError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => ({}))
  return new Error(body.detail || `API error ${res.status}`)
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...authHeaders(),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    throw await parseApiError(res)
  }
  return res.json()
}

function shouldUseLocalVaultFallback(err: unknown): boolean {
  if (!hasLocalVault()) return false
  if (!(err instanceof Error)) return true
  return (
    err.message.includes('Failed to fetch') ||
    err.message.includes('API error ') ||
    err.message.includes('HTTP ')
  )
}

export interface ClerkBridgeResult {
  authenticated: boolean
  user_id: string
  email: string
  role: string
  target_user?: string | null
  redirect_to: string
}

export async function bridgeClerkSession(clerkToken: string): Promise<ClerkBridgeResult> {
  const res = await fetch('/api/clerk/bridge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clerkToken}`,
    },
  })
  if (!res.ok) throw await parseApiError(res)
  return res.json()
}

export async function clearClerkBridgeSession(): Promise<{ status: string }> {
  const res = await fetch('/api/clerk/logout', {
    method: 'POST',
  })
  if (!res.ok) throw await parseApiError(res)
  return res.json()
}

export interface AccessRequestPayload {
  name: string
  email: string
  organization: string
  use_case: string
}

export interface AccessRequestResult {
  status: 'submitted'
  request_id: string
  message: string
}

export async function submitAccessRequest(payload: AccessRequestPayload): Promise<AccessRequestResult> {
  const res = await fetch('/auth/clerk/api/public/access-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw await parseApiError(res)
  return res.json()
}

const _inflightPMState = new Map<string, Promise<any>>()
const _inflightChildren = new Map<string, Promise<any>>()
let _inflightSessions: Promise<{ sessions: Session[]; count: number; vault_root?: string | null }> | null = null

function dedupeInFlight<T>(map: Map<string, Promise<T>>, key: string, factory: () => Promise<T>): Promise<T> {
  const existing = map.get(key)
  if (existing) return existing
  const promise = factory().finally(() => {
    if (map.get(key) === promise) map.delete(key)
  })
  map.set(key, promise)
  return promise
}

// --- Sessions ---

export async function fetchSessions(): Promise<{ sessions: Session[]; count: number; vault_root?: string | null }> {
  if (_inflightSessions) return _inflightSessions
  const promise = (async () => {
    try {
      return await apiFetch<{ sessions: Session[]; count: number; vault_root?: string | null }>('/api/sessions')
    } catch (err) {
      if (shouldUseLocalVaultFallback(err)) return fetchLocalSessions()
      throw err
    }
  })()
    .finally(() => {
      if (_inflightSessions === promise) _inflightSessions = null
    })
  _inflightSessions = promise
  return promise
}

export async function fetchMessages(
  name: string,
  after?: string,
): Promise<{ messages: Message[]; last_uuid: string; count: number }> {
  const params = new URLSearchParams()
  if (after) params.set('after', after)
  const qs = params.toString()
  try {
    return await apiFetch(`/api/sessions/${name}/messages${qs ? '?' + qs : ''}`)
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return fetchLocalMessages(name)
    throw err
  }
}

export async function sendMessage(
  name: string,
  message: string,
  opts?: { method?: 'send-keys' | 'inbox'; submit?: boolean },
): Promise<{ status: string }> {
  return apiFetch(`/api/sessions/${name}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      method: opts?.method ?? 'send-keys',
      submit: opts?.submit ?? true,
    }),
  })
}

export interface BrowserSettings {
  note: string
  path: string
  max_chars: number
}

export interface BrowserInitResponse {
  state: 'ready' | 'initializing'
  context_id: string | null
  message_id: string | null
}

export interface BrowserStateResponse {
  state: 'ready' | 'initializing' | 'pending' | 'unmapped'
  context_id: string | null
  ttl_left_sec?: number
}

// Ask the agent to allocate its playwright BrowserContext so the dashboard
// can attach. Returns immediately — server arms expect_next and queues a
// system message in the agent's inbox.
export async function initBrowser(session: string): Promise<BrowserInitResponse> {
  return apiFetch(`/api/browser/init?session=${encodeURIComponent(session)}`, {
    method: 'POST',
  })
}

// Poll endpoint for the BrowserView to detect when init has completed.
export async function getBrowserState(session: string): Promise<BrowserStateResponse> {
  return apiFetch(`/api/browser/state?session=${encodeURIComponent(session)}`)
}

export interface LLMCategorySettings {
  provider?: string | null
  runtime?: string | null
  default_model_by_runtime?: Record<string, string>
  default_model_by_provider?: Record<string, string>
}

export interface LLMModelOption {
  id: string
  label: string
}

export interface ResolvedInteractiveCategory {
  category: string
  provider: string
  runtime: string
  model: string | null
  source: string
  provider_available: boolean
  available_models: LLMModelOption[]
}

export interface LLMSettings {
  version?: number
  providers?: {
    default_provider?: string | null
  }
  categories?: Record<string, LLMCategorySettings>
  services?: Record<string, { default_model?: string | null }>
}

export interface LLMSettingsPayload {
  settings: LLMSettings
  providers: Record<string, boolean>
  effective_default_provider?: string | null
  resolved_interactive_categories: Record<string, ResolvedInteractiveCategory>
  available_models: Record<string, LLMModelOption[]>
  selectable_models: Record<string, LLMModelOption[]>
  runtime_availability: Record<string, boolean>
  service_models: Record<string, LLMModelOption[]>
  service_provider_status: Record<string, string>
  warnings: string[]
}

export async function fetchBrowserSettings(): Promise<BrowserSettings> {
  return apiFetch('/api/browser/settings')
}

export async function saveBrowserSettings(note: string): Promise<BrowserSettings & { status: string }> {
  return apiFetch('/api/browser/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  })
}

export async function fetchLLMSettings(): Promise<LLMSettingsPayload> {
  return apiFetch('/api/settings/llm')
}

export async function saveLLMSettings(settings: LLMSettings): Promise<LLMSettingsPayload> {
  return apiFetch('/api/settings/llm', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  })
}

export async function createSession(
  prompt: string,
  model?: string,
  runtime?: string,
): Promise<{ session_name: string }> {
  const body: Record<string, string> = { prompt }
  if (model) body.model = model
  if (runtime) body.runtime = runtime
  return apiFetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function killSession(name: string): Promise<{ status: string }> {
  return apiFetch(`/api/sessions/${name}`, { method: 'DELETE' })
}

export async function restartSession(name: string): Promise<{ status: string; session: string }> {
  return apiFetch(`/api/sessions/${name}/restart`, { method: 'POST' })
}

export async function createHelperSession(): Promise<{ session_name: string }> {
  return apiFetch('/api/sessions/helper', { method: 'POST' })
}

export async function createConciergeSession(): Promise<{ session_name: string }> {
  return apiFetch('/api/sessions/concierge', { method: 'POST' })
}

export async function wrapupSession(name: string): Promise<{ status: string; receipt?: string }> {
  return apiFetch(`/api/sessions/${name}/wrapup`, { method: 'POST' })
}

export async function loginSession(name: string): Promise<{ url: string; session: string }> {
  return apiFetch(`/api/sessions/${name}/login`, { method: 'POST' })
}

export async function submitLoginCode(name: string, code: string): Promise<{ status: string; session: string }> {
  return apiFetch(`/api/sessions/${name}/login/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
}

export interface ClaudeAuthStatus {
  loggedIn: boolean
  authMethod?: string | null
  apiProvider?: string | null
  email?: string | null
  orgId?: string | null
  orgName?: string | null
  subscriptionType?: string | null
}

export async function fetchClaudeAuthStatus(): Promise<ClaudeAuthStatus> {
  return apiFetch('/api/auth/status')
}

export async function loginClaudeAuth(): Promise<{ url: string; session: string }> {
  return apiFetch('/api/auth/login', { method: 'POST' })
}

export async function logoutClaudeAuth(): Promise<{ status: string }> {
  return apiFetch('/api/auth/logout', { method: 'POST' })
}

// --- Provider Hub (multi-provider auth) ---

export interface ProviderStatus {
  loggedIn: boolean
  error?: string
  // Claude-specific
  authMethod?: string | null
  apiProvider?: string | null
  email?: string | null
  orgId?: string | null
  orgName?: string | null
  subscriptionType?: string | null
  // Codex-specific
  statusText?: string | null
}

export type ProvidersMap = Record<string, ProviderStatus>

export async function fetchProviders(): Promise<ProvidersMap> {
  return apiFetch('/api/providers')
}

export async function providerLogin(provider: string): Promise<{ url: string; code?: string; session?: string }> {
  return apiFetch(`/api/providers/${provider}/login`, { method: 'POST' })
}

export async function providerStatus(provider: string): Promise<ProviderStatus> {
  return apiFetch(`/api/providers/${provider}/status`)
}

export async function providerLogout(provider: string): Promise<{ status: string }> {
  return apiFetch(`/api/providers/${provider}/logout`, { method: 'POST' })
}

export async function sendCommand(
  name: string,
  command: string,
): Promise<{ status: string }> {
  return apiFetch(`/api/sessions/${name}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  })
}

export async function setPendingMessage(name: string, message: string): Promise<{ status: string }> {
  return apiFetch(`/api/sessions/${name}/pending-message`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}

export async function clearPendingMessage(name: string): Promise<{ status: string }> {
  return apiFetch(`/api/sessions/${name}/pending-message`, { method: 'DELETE' })
}

// --- Vault ---

export async function fetchVaultFile(path: string): Promise<VaultFile> {
  try {
    return await apiFetch(`/api/vault/file?path=${encodeURIComponent(path)}`)
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return fetchLocalVaultFile(path)
    throw err
  }
}

export async function restartServer(): Promise<void> {
  await apiFetch('/api/restart', { method: 'POST' })
}

export interface SpawnerHealth {
  ok: boolean
  uptime_s?: number
  in_flight?: number
  calls_total?: number
  errors_total?: number
  p50_ms?: number
  p95_ms?: number
  p99_ms?: number
  lock_wait_p50_ms?: number
  lock_wait_p95_ms?: number
  codex_watcher_sessions?: number
  codex_poll_active?: number
  session_lock_keys?: number
  chat_lock_keys?: number
  version?: string
  error?: string
}

export async function fetchSpawnerHealth(): Promise<SpawnerHealth> {
  return apiFetch('/api/spawner-health')
}

export async function stopSpawnerBackend(): Promise<{ status: string }> {
  return apiFetch('/api/spawner-health/stop', { method: 'POST' })
}

export async function startSpawnerBackend(): Promise<{ status: string; rc: number }> {
  return apiFetch('/api/spawner-health/start', { method: 'POST' })
}

export async function saveVaultFile(path: string, content: string): Promise<{ status: string }> {
  try {
    return await apiFetch(`/api/vault/file?path=${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) saveLocalVaultFile(path, content)
    throw err
  }
}

export async function uploadFile(file: File, dest?: string): Promise<{ path: string; size: number; name: string }> {
  const form = new FormData()
  form.append('file', file)
  const params = new URLSearchParams()
  if (dest) params.set('dest', dest)
  const qs = params.toString()
  const res = await fetch(`/api/vault/upload${qs ? '?' + qs : ''}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!res.ok) {
    throw await parseApiError(res)
  }
  return res.json()
}

export function downloadVaultUrl(path: string): string {
  const params = new URLSearchParams({ path })
  if (AUTH_TOKEN) params.set('token', AUTH_TOKEN)
  return `/api/vault/download?${params.toString()}`
}

export function vaultPreviewUrl(path: string): string {
  const params = new URLSearchParams({ path })
  if (AUTH_TOKEN) params.set('token', AUTH_TOKEN)
  return `/api/vault/preview?${params.toString()}`
}

export async function deleteVaultItem(path: string): Promise<{ status: string; path: string; type: string }> {
  return apiFetch(`/api/vault/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
}

export async function createVaultItem(
  dir: string,
  name: string,
  type: 'file' | 'folder' = 'file',
  content?: string,
): Promise<{ status: string; path: string; name: string; type: string }> {
  return apiFetch('/api/vault/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir, name, type, content }),
  })
}

export async function renameVaultItem(
  path: string,
  newName: string,
): Promise<{ status: string; path: string; old_name: string; new_name: string }> {
  return apiFetch('/api/vault/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, new_name: newName }),
  })
}

export async function moveVaultItems(
  paths: string[],
  destDir: string,
): Promise<{ status: string; results: { path: string; status: string; new_path?: string; error?: string }[] }> {
  return apiFetch('/api/vault/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths, dest_dir: destDir }),
  })
}

export async function resolveWikilink(target: string): Promise<{ path: string }> {
  try {
    return await apiFetch(`/api/vault/resolve?target=${encodeURIComponent(target)}`)
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return resolveLocalWikilink(target)
    throw err
  }
}

export async function fetchVaultTree(root?: string): Promise<{ tree: TreeNode[] }> {
  const params = new URLSearchParams()
  if (root) params.set('root', root)
  const qs = params.toString()
  try {
    return await apiFetch(`/api/vault/tree${qs ? '?' + qs : ''}`)
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return fetchLocalVaultTree(root)
    throw err
  }
}

export async function fetchVaultDirectory(path: string): Promise<{
  path: string
  entries: { name: string; type: 'file' | 'dir'; size?: number; count?: number }[]
}> {
  try {
    return await apiFetch(`/api/vault/directory?path=${encodeURIComponent(path)}`)
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return fetchLocalVaultDirectory(path)
    throw err
  }
}

export async function searchVaultFiles(
  q: string,
  root?: string,
  limit?: number,
): Promise<{
  results: { name: string; path: string; size: number; mtime: number }[]
  total: number
}> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (root) params.set('root', root)
  if (limit) params.set('limit', String(limit))
  try {
    return await apiFetch(`/api/vault/search?${params.toString()}`)
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return searchLocalVaultFiles(q, root, limit)
    throw err
  }
}

export async function searchVaultDirs(
  q: string,
  root?: string,
  limit?: number,
): Promise<{
  results: { name: string; path: string }[]
  total: number
}> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (root) params.set('root', root)
  if (limit) params.set('limit', String(limit))
  try {
    return await apiFetch(`/api/vault/search-dirs?${params.toString()}`)
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return searchLocalVaultDirs(q, root, limit)
    throw err
  }
}

// --- Semantic Search (fast hybrid, no agent) ---

export interface SemanticSearchResult {
  id: string
  document_id: string
  doc_type: string
  title: string
  project_id: string
  entity_id: string | null
  chunk_type: string
  text: string
  score: number
  vector_score: number
  text_score: number
  group_id: string
  mtime?: number | null
}

export interface SemanticSearchResponse {
  query: string
  results: SemanticSearchResult[]
  total: number
}

export async function semanticSearch(
  q: string,
  limit: number = 10,
  docType: string = '',
  project: string = '',
): Promise<SemanticSearchResponse> {
  const params = new URLSearchParams({ q, limit: String(limit) })
  if (docType) params.set('doc_type', docType)
  if (project) params.set('project', project)
  return apiFetch(`/api/search/semantic?${params.toString()}`)
}

// --- Agentic Search ---

export interface AgentSearchResult {
  path: string
  title: string
  entity_type: string
  why: string
  confidence: 'high' | 'medium' | 'low'
  status?: string
  last_activity?: string
}

export interface AgentSearchResponse {
  query_understanding: string
  results: AgentSearchResult[]
  conversation_id: string
}

export async function agentSearch(
  query: string,
  context: string = '',
  conversationId: string = '',
): Promise<AgentSearchResponse> {
  return apiFetch('/api/search/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, context, conversation_id: conversationId }),
  })
}

export async function releaseAgentSearch(conversationId: string): Promise<void> {
  await apiFetch('/api/search/agent/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId }),
  })
}

// --- Notifications ---

export async function fetchNotifications(): Promise<{ notifications: Notification[] }> {
  return apiFetch('/api/notifications')
}

export async function acknowledgeNotification(id: string): Promise<void> {
  await apiFetch(`/api/notifications/${id}/acknowledge`, { method: 'POST' })
}

// --- Voice Pipeline ---

export async function fetchVoiceStatus(): Promise<{ running: boolean; ready: boolean; pid: number | null; muted: boolean; available?: boolean }> {
  return apiFetch('/api/voice/status')
}

export async function startVoicePipeline(): Promise<void> {
  await apiFetch('/api/voice/start', { method: 'POST' })
}

export async function stopVoicePipeline(): Promise<void> {
  await apiFetch('/api/voice/stop', { method: 'POST' })
}

export async function muteVoicePipeline(): Promise<void> {
  await apiFetch('/api/voice/mute', { method: 'POST' })
}

export async function unmuteVoicePipeline(): Promise<void> {
  await apiFetch('/api/voice/unmute', { method: 'POST' })
}

// --- Speak (TTS) ---

export async function speakText(text: string, voice?: string): Promise<Blob> {
  const body: Record<string, string> = { text }
  if (voice) body.voice = voice
  const res = await fetch('/api/speak', {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Speak error ${res.status}`)
  }
  return res.blob()
}

// --- Transcribe ---

export async function transcribeAudio(blob: Blob, filename: string): Promise<{ text: string }> {
  const form = new FormData()
  form.append('audio', blob, filename)
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!res.ok) throw new Error(`Transcribe error ${res.status}`)
  return res.json()
}

export async function checkVoiceSupport(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false
  try {
    const data = await apiFetch<{ available: boolean }>('/api/transcribe/status')
    return data.available
  } catch {
    return false
  }
}

// --- PM (Project Management) ---

export async function fetchPMState(project: string): Promise<{
  state: any
  growth_stage: string
  is_mock: boolean
  source: string
}> {
  const path = `/api/pm/state?project=${encodeURIComponent(project)}`
  return dedupeInFlight(_inflightPMState, path, async () => {
    try {
      return await apiFetch(path)
    } catch (err) {
      if (shouldUseLocalVaultFallback(err)) return fetchLocalPMState(project)
      throw err
    }
  })
}

export async function fetchPMProjects(): Promise<{
  projects: { id: string; title: string; type: string; status: string; vision: string; has_state: boolean }[]
}> {
  try {
    return await apiFetch('/api/pm/projects')
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return fetchLocalPMProjects()
    throw err
  }
}

export async function fetchUserTasks(): Promise<{
  tasks: any[]
  pending_count: number
  blocking_count: number
}> {
  try {
    return await apiFetch('/api/pm/user-tasks')
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return fetchLocalUserTasks()
    throw err
  }
}

export async function resolveUserTask(
  taskId: string,
  resolution?: string,
  status?: 'resolved' | 'dismissed',
): Promise<{ status: string; task_id: string; session_name?: string }> {
  return apiFetch(`/api/pm/user-tasks/${encodeURIComponent(taskId)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resolution: resolution || 'Marked done from dashboard',
      status: status || 'resolved',
    }),
  })
}

export async function resolveTaskPath(project: string, taskId: string): Promise<{ path: string }> {
  try {
    return await apiFetch(`/api/pm/task-path?project=${encodeURIComponent(project)}&task_id=${encodeURIComponent(taskId)}`)
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return resolveLocalTaskPath(project, taskId)
    throw err
  }
}

export async function fetchChildren(project: string, parentId?: string): Promise<{
  parent: any
  children: any[]
  mtime?: number
}> {
  const params = new URLSearchParams({ project })
  if (parentId) params.set('parent_id', parentId)
  const path = `/api/pm/children?${params.toString()}`
  return dedupeInFlight(_inflightChildren, path, async () => {
    try {
      return await apiFetch(path)
    } catch (err) {
      if (shouldUseLocalVaultFallback(err)) return fetchLocalChildren(project, parentId)
      throw err
    }
  })
}

export async function fetchMtime(project: string, nodeId?: string): Promise<{ mtime: number }> {
  const params = new URLSearchParams({ project })
  if (nodeId) params.set('node_id', nodeId)
  try {
    return await apiFetch(`/api/pm/mtime?${params.toString()}`)
  } catch (err) {
    if (shouldUseLocalVaultFallback(err)) return fetchLocalMtime(project, nodeId)
    throw err
  }
}

export async function updateTaskFields(
  project: string,
  taskId: string,
  fields: {
    goal?: string | null
    deps?: string[]
    status?: string
    title?: string
    desc?: string
    objective?: string
    outcome?: string
    owner?: string[]
    done_when?: { text: string; done: boolean }[]
    context?: { purpose?: string; background?: string[]; decisions?: string[]; references?: string[] }
    open_questions?: string[]
    focus?: string
    priorities?: string[]
    horizon?: string
  },
): Promise<{ status: string; task_id: string; state_regenerated?: boolean }> {
  return apiFetch(`/api/pm/tasks/${encodeURIComponent(taskId)}/fields?project=${encodeURIComponent(project)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
}

export async function reorderTasks(
  project: string,
  parentId: string,
  order: string[],
): Promise<{ status: string; updated: number }> {
  return apiFetch('/api/pm/tasks/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, parent_id: parentId, order }),
  })
}

export async function moveTask(
  project: string,
  taskId: string,
  newParentId: string,
): Promise<{ status: string; old_task_id: string; new_task_id: string; old_path: string; new_path: string }> {
  return apiFetch('/api/pm/tasks/move', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, task_id: taskId, new_parent_id: newParentId }),
  })
}

export async function renameTask(
  project: string,
  taskId: string,
  newTitle: string,
): Promise<{ status: string; task_id: string; new_title: string; renamed: boolean; new_folder?: string }> {
  return apiFetch(`/api/pm/tasks/${encodeURIComponent(taskId)}/rename?project=${encodeURIComponent(project)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_title: newTitle }),
  })
}

// --- Goal editing ---

export async function updateGoal(
  project: string,
  goalId: string,
  fields: {
    sequence?: { id: string; title?: string; depends_on?: string[] }[]
    milestones?: { id: string; title?: string; steps?: string[] }[]
    done_when?: { text: string; done: boolean }[]
    title?: string
    target?: string
    status?: string
    observations?: { date: string; note: string }[]
    decisions?: { date: string; decision: string; context?: string }[]
    references?: string[]
    tagged_backlog?: { title: string; est_hours?: number }[]
  },
): Promise<{ status: string; goal_id: string; state_regenerated?: boolean }> {
  return apiFetch(`/api/pm/goals/${encodeURIComponent(goalId)}?project=${encodeURIComponent(project)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
}

export async function createGoal(
  project: string,
  fields: { title: string; description?: string; target?: string; done_when?: string[] },
): Promise<{ status: string; goal_id: string }> {
  return apiFetch(`/api/pm/goals?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
}

export async function deleteGoal(
  project: string,
  goalId: string,
  untagTasks: boolean = false,
): Promise<{ status: string; goal_id: string; deleted: boolean; tasks_untagged?: number }> {
  const params = new URLSearchParams({ project })
  if (untagTasks) params.set('untag_tasks', 'true')
  return apiFetch(`/api/pm/goals/${encodeURIComponent(goalId)}?${params.toString()}`, {
    method: 'DELETE',
  })
}

// --- Task search (for goal task picker) ---

export interface SearchTask {
  id: string
  title: string
  status: string
  est_hours: number | null
  goals: string[]
  domain?: string
}

export async function searchTasks(
  project: string,
  opts: { q?: string; excludeGoal?: string; limit?: number } = {},
): Promise<{ tasks: SearchTask[]; total: number }> {
  const params = new URLSearchParams({ project })
  if (opts.q) params.set('q', opts.q)
  if (opts.excludeGoal) params.set('exclude_goal', opts.excludeGoal)
  if (opts.limit) params.set('limit', String(opts.limit))
  return apiFetch(`/api/pm/tasks/search?${params.toString()}`)
}

export async function addTasksToGoal(
  project: string,
  goalId: string,
  taskIds: string[],
  milestoneId?: string,
): Promise<{ status: string; tasks_updated: number }> {
  return apiFetch(`/api/pm/goals/${encodeURIComponent(goalId)}/tasks?project=${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_ids: taskIds, milestone_id: milestoneId }),
  })
}

// --- Plan & Log ---

export interface PlanStep {
  index: number
  text: string
  done: boolean
  phase: string | null
}

export interface PlanData {
  steps: PlanStep[]
  progress: { done: number; total: number }
  current_status: { done?: string; remains?: string; blockers?: string; next?: string } | null
  scope: { in_scope: string[]; out_scope: string[] } | null
  current_step: number
  updated: string
}

export interface LogEntry {
  heading: string
  body: string
}

export interface LogData {
  resume_brief: { status?: string; next?: string; blockers?: string } | null
  entries: LogEntry[]
  entry_count: number
}

export async function fetchPlan(project: string, nodeId: string): Promise<PlanData> {
  return apiFetch(`/api/pm/plan?project=${encodeURIComponent(project)}&node_id=${encodeURIComponent(nodeId)}`)
}

export async function togglePlanStep(
  project: string,
  nodeId: string,
  stepIndex: number,
  checked: boolean,
): Promise<{ status: string; progress: { done: number; total: number } }> {
  return apiFetch('/api/pm/plan-toggle', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, node_id: nodeId, step_index: stepIndex, checked }),
  })
}

export async function fetchLog(project: string, nodeId: string): Promise<LogData> {
  return apiFetch(`/api/pm/log?project=${encodeURIComponent(project)}&node_id=${encodeURIComponent(nodeId)}`)
}

// --- Home layout (section collapse, agent groups, per-session placements) ---

export interface HomeSection {
  collapsed: boolean
}

export type HomeGroupKind = 'auto:role' | 'auto:other' | 'user'

export interface HomeGroup {
  id: string
  label: string
  kind: HomeGroupKind
  role?: string
  collapsed: boolean
  order: number
}

export interface HomePlacement {
  group: string
  order: number
}

export interface HomeLayout {
  version: number
  sections: { active: HomeSection; past: HomeSection; [k: string]: HomeSection }
  groups: HomeGroup[]
  placements: Record<string, HomePlacement>
}

export async function fetchHomeLayout(): Promise<HomeLayout> {
  return apiFetch('/api/home/layout')
}

export async function putHomeLayout(layout: HomeLayout): Promise<{ status: string }> {
  return apiFetch('/api/home/layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(layout),
  })
}

// --- Session metadata (persisted, works for dead sessions) ---

export async function fetchSessionMeta(name: string): Promise<{
  session_name: string
  working_dir: string
  jsonl_path?: string
  claude_session_id?: string
  task_path?: string
  vault_root?: string
  agent_role?: string
  task_title?: string
}> {
  return apiFetch(`/api/sessions/${encodeURIComponent(name)}/meta`)
}

// --- Past session history ---

export async function fetchSessionCards(): Promise<{ cards: Record<string, import('./types').SessionCard> }> {
  return apiFetch('/api/sessions/cards')
}

export async function fetchPastAgents(opts?: {
  days?: number
  limit?: number
  q?: string
  project?: string
  workingDirPrefixes?: string[]
  taskIdPrefixes?: string[]
}): Promise<{ sessions: import('./types').PastAgent[]; total: number }> {
  const params = new URLSearchParams()
  if (opts?.days) params.set('days', String(opts.days))
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.q) params.set('q', opts.q)
  if (opts?.project) params.set('project', opts.project)
  if (opts?.workingDirPrefixes?.length) params.set('working_dir_prefix', opts.workingDirPrefixes.join(','))
  if (opts?.taskIdPrefixes?.length) params.set('task_id_prefix', opts.taskIdPrefixes.join(','))
  return apiFetch(`/api/sessions/history/list?${params.toString()}`)
}

export async function fetchHistoryMessages(
  jsonlPath: string,
  after?: string,
): Promise<{ messages: Message[]; last_uuid: string; count: number }> {
  const params = new URLSearchParams({ jsonl_path: jsonlPath })
  if (after) params.set('after', after)
  return apiFetch(`/api/sessions/history?${params.toString()}`)
}

// --- PM Session Spawn ---

export async function spawnTaskAgent(opts: {
  working_dir: string
  model?: string
  autonomy?: string
  prompt?: string
  resume_session_id?: string
  conversation?: boolean
  runtime?: string
  display_name?: string
  surface?: string
}): Promise<{ session_name: string; working_dir: string }> {
  return apiFetch('/api/sessions/spawn-task-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
}

export async function setSessionDisplayName(
  sessionName: string,
  displayName: string | null,
): Promise<{ status: string; session: string; display_name: string | null }> {
  return apiFetch(`/api/sessions/${encodeURIComponent(sessionName)}/display-name`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: displayName }),
  })
}

export async function createTask(opts: {
  project: string
  parent_id: string
  title: string
  is_scratch?: boolean
  autonomy?: string
}): Promise<{ status: string; task_id: string; path: string; folder: string }> {
  return apiFetch('/api/pm/tasks/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
}

export async function archiveTask(opts: {
  project: string
  task_id: string
}): Promise<{ status: string; task_id: string; title: string; archived_to: string }> {
  return apiFetch('/api/pm/tasks/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
}

export async function deleteTask(opts: {
  project: string
  task_id: string
}): Promise<{ status: string; task_id: string; title: string }> {
  return apiFetch('/api/pm/tasks/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
}

export async function createProject(opts: {
  name: string
  vision?: string
}): Promise<{ status: string; project_id: string; path: string }> {
  return apiFetch('/api/pm/projects/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
}

export async function deleteProject(opts: {
  project: string
}): Promise<{ status: string; project: string; tasks_cleaned: number }> {
  return apiFetch('/api/pm/projects/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
}

export async function createArea(opts: {
  project: string
  parent_id: string
  title: string
  purpose?: string
}): Promise<{ status: string; area_id: string; path: string; folder: string }> {
  return apiFetch('/api/pm/areas/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
}

// --- Onboarding ---

export async function seedDemoProject(): Promise<{ status: string; project_id: string; already_existed: boolean }> {
  return apiFetch('/api/pm/seed-demo', { method: 'POST' })
}

// --- LaTeX ---

export async function checkLatexStatus(): Promise<{
  pdflatex_available: boolean
  pdflatex_path: string | null
  bibtex_available: boolean
  biber_available: boolean
}> {
  return apiFetch('/api/latex/status')
}

export async function compileLatex(path: string): Promise<{
  ok: boolean
  pdf_path?: string
  errors?: { line: number | null; message: string; full_context: string }[]
  warnings?: string[]
  warning_count?: number
  log?: string
}> {
  return apiFetch('/api/latex/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
}

// --- Collabora (Office editing) ---

export async function fetchCollaboraStatus(): Promise<{ available: boolean; url: string | null }> {
  return apiFetch('/api/collabora/status')
}

export async function fetchCollaboraEditorUrl(path: string): Promise<{
  editor_url: string
  access_token: string
  access_token_ttl: number
  file_id: string
}> {
  return apiFetch(`/api/collabora/editor-url?path=${encodeURIComponent(path)}`)
}

// --- WebSocket URL helpers ---

export function streamWsUrl(name: string, cursor?: string | null): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams()
  if (cursor) params.set('after', cursor)
  if (AUTH_TOKEN) params.set('token', AUTH_TOKEN)
  const qs = params.toString()
  return `${proto}//${location.host}/api/sessions/${name}/stream${qs ? '?' + qs : ''}`
}

export function terminalWsUrl(name: string, cols: number, rows: number): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams()
  params.set('cols', String(cols))
  params.set('rows', String(rows))
  if (AUTH_TOKEN) params.set('token', AUTH_TOKEN)
  return `${proto}//${location.host}/api/sessions/${name}/terminal?${params.toString()}`
}

export function transcribeStreamWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams()
  if (AUTH_TOKEN) params.set('token', AUTH_TOKEN)
  const qs = params.toString()
  return `${proto}//${location.host}/api/transcribe/stream${qs ? '?' + qs : ''}`
}

// --- Global Search ---

export interface ProjectSearchResult {
  id: string; title: string; status: string; type: 'project'; vision: string
  last_activity: string | null
}

export interface TaskSearchResult {
  id: string; title: string; status: string; type: string
  project: string; est_hours: number | null; desc: string
  last_activity: string | null
}

export interface SessionSearchResult {
  name: string; task_title: string | null; role: string | null
  status: string; live: boolean; project_id: string | null
  task_id: string | null; working_dir: string | null
}

export interface HistorySearchResult {
  name: string; task_title: string | null; role: string
  outcome: string; ended: string; project_id: string | null
  jsonl_path: string | null
  task_id: string | null; task_status: string | null
  next_step: string | null; summary: string | null
  files_changed: string[]
  session_id: string | null
  working_dir: string | null
}

export interface FileSearchResult {
  name: string; path: string; size: number; mtime: number
}

export interface GlobalSearchResults {
  query: string
  results: {
    projects: { items: ProjectSearchResult[]; total: number }
    tasks: { items: TaskSearchResult[]; total: number }
    sessions: { items: SessionSearchResult[]; total: number }
    history: { items: HistorySearchResult[]; total: number }
    files: { items: FileSearchResult[]; total: number }
  }
  total: number
}

export async function unifiedSearch(
  q: string,
  opts?: { limit?: number; project?: string },
): Promise<GlobalSearchResults> {
  const params = new URLSearchParams({ q })
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.project) params.set('project', opts.project)
  return apiFetch(`/api/search?${params.toString()}`)
}

export function voiceAudioWsUrl(model: string = 'haiku'): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams()
  params.set('model', model)
  if (AUTH_TOKEN) params.set('token', AUTH_TOKEN)
  return `${proto}//${location.host}/api/voice/audio?${params.toString()}`
}

export function browserScreencastWsUrl(sessionName?: string | null): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams()
  if (AUTH_TOKEN) params.set('token', AUTH_TOKEN)
  if (sessionName) params.set('session', sessionName)
  return `${proto}//${location.host}/api/browser/screencast?${params.toString()}`
}

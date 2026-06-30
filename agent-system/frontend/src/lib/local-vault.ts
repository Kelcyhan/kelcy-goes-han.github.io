import yaml from 'js-yaml'
import type { Message, Session, TreeNode, VaultFile } from './types.ts'
import type { VaultPage } from './dataview.ts'

const rawFiles = import.meta.glob('../../../vault/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

type Frontmatter = Record<string, unknown>

interface TaskDoc {
  path: string
  dir: string
  body: string
  fm: Frontmatter
}

const files = Object.fromEntries(
  Object.entries(rawFiles).map(([path, content]) => [
    path.replace(/^\.\.\/\.\.\/\.\.\/vault\//, ''),
    content,
  ]),
)

function basename(path: string): string {
  return path.split('/').pop() || path
}

function dirname(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

function normalizeYamlValue(value: unknown): unknown {
  if (value instanceof Date) {
    const iso = value.toISOString()
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso
  }
  if (Array.isArray(value)) return value.map(normalizeYamlValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, normalizeYamlValue(child)]),
    )
  }
  return value
}

function normalizeYamlObject(value: unknown): Frontmatter {
  const normalized = normalizeYamlValue(value)
  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? normalized as Frontmatter
    : {}
}

function parseMarkdown(content: string): { frontmatter: Frontmatter; body: string } {
  if (!content.startsWith('---\n')) return { frontmatter: {}, body: content }
  const end = content.indexOf('\n---', 4)
  if (end < 0) return { frontmatter: {}, body: content }
  const raw = content.slice(4, end)
  const body = content.slice(content.indexOf('\n', end + 4) + 1)
  const parsed = yaml.load(raw)
  return {
    frontmatter: normalizeYamlObject(parsed),
    body,
  }
}

function parseYamlFile(path: string): Frontmatter | null {
  const content = files[path]
  if (!content) return null
  const parsed = yaml.load(content)
  const normalized = normalizeYamlObject(parsed)
  return Object.keys(normalized).length > 0 ? normalized : null
}

function progress(value: unknown): { done: number; total: number } {
  if (typeof value === 'object' && value !== null && 'done' in value && 'total' in value) {
    const p = value as { done?: unknown; total?: unknown }
    return { done: Number(p.done) || 0, total: Number(p.total) || 0 }
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d+)\s*\/\s*(\d+)$/)
    if (match) return { done: Number(match[1]), total: Number(match[2]) }
  }
  return { done: 0, total: 0 }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function asRecords(value: unknown): Frontmatter[] {
  return Array.isArray(value)
    ? value.filter((item): item is Frontmatter => item !== null && typeof item === 'object' && !Array.isArray(item))
    : []
}

const taskDocs: TaskDoc[] = Object.entries(files)
  .filter(([path]) => path.startsWith('projects/') && path.endsWith('/task.md'))
  .map(([path, content]) => {
    const parsed = parseMarkdown(content)
    return { path, dir: dirname(path), body: parsed.body, fm: parsed.frontmatter }
  })
  .sort((a, b) => String(a.fm.id || '').localeCompare(String(b.fm.id || ''), undefined, { numeric: true }))

function projectRoot(project: string): TaskDoc | undefined {
  return taskDocs.find(doc => doc.path === `projects/${project}/task.md`)
}

function projectTasks(project: string): TaskDoc[] {
  return taskDocs.filter(doc => doc.path.startsWith(`projects/${project}/`))
}

function taskById(project: string, id: string): TaskDoc | undefined {
  return projectTasks(project).find(doc => String(doc.fm.id) === id)
}

function directChildTaskDocs(project: string, parentId: string): TaskDoc[] {
  return projectTasks(project)
    .filter(doc => String(doc.fm.id) !== parentId)
    .filter(doc => String(doc.fm.parent || '1') === parentId)
}

function directEntries(dir: string): { name: string; path: string; type: 'file' | 'folder'; size?: number; count?: number }[] {
  const entries = new Map<string, { name: string; path: string; type: 'file' | 'folder'; size?: number; count?: number }>()
  const prefix = dir ? `${dir}/` : ''
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(prefix) || path === dir) continue
    const rest = path.slice(prefix.length)
    if (!rest || rest.includes('/')) {
      const folder = rest.split('/')[0]
      if (folder) entries.set(folder, { name: folder, path: `${prefix}${folder}`, type: 'folder' })
    } else {
      entries.set(rest, { name: rest, path, type: 'file', size: content.length })
    }
  }
  return [...entries.values()].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })
}

function fileInfos(dir: string) {
  return directEntries(dir)
    .filter(entry => entry.name !== 'task.md')
    .map(entry => ({
      name: entry.name,
      path: entry.path,
      type: entry.type === 'folder' ? 'folder' as const : 'file' as const,
      size: entry.size,
      count: entry.count,
    }))
}

function taskWorkingDir(projectId: unknown, taskId: unknown): string | undefined {
  if (!projectId || !taskId) return undefined
  const task = String(taskId)
  return task === '1'
    ? `projects/${String(projectId)}`
    : `projects/${String(projectId)}/${task.replace(/\./g, '_')}`
}

function sessionPlaceholders(fm: Frontmatter) {
  return asStringArray(fm.session_ids).map(id => ({
    name: id,
    status: 'past',
    role: 'agent',
    uuid: id,
    task_id: fm.id == null ? undefined : String(fm.id),
    working_dir: taskWorkingDir(fm.project_id, fm.id),
  }))
}

function nodeFromTask(project: string, doc: TaskDoc) {
  const fm = doc.fm
  const id = String(fm.id || '1')
  const children = directChildTaskDocs(project, id)
  const pastSessions = sessionPlaceholders(fm)
  return {
    id,
    title: String(fm.title || id),
    type: fm.type || 'task',
    desc: fm.desc || '',
    status: String(fm.status || 'todo'),
    path: doc.path,
    objective: fm.objective,
    done_when: fm.verification || fm.done_when || [],
    outcome: fm.outcome || '',
    goal: fm.goal,
    goals: asStringArray(fm.goals),
    owner: fm.owner,
    autonomy: fm.autonomy,
    deps: asStringArray(fm.deps),
    started: fm.started,
    updated: fm.updated || fm.last_activity,
    files: fileInfos(doc.dir),
    sessions: [],
    past_sessions: pastSessions,
    session_ids: asStringArray(fm.session_ids),
    backlog: fm.backlog || [],
    context: fm.context,
    open_questions: asStringArray(fm.open_questions),
    focus: fm.focus,
    priorities: asStringArray(fm.priorities),
    horizon: fm.horizon,
    health: fm.health,
    last_activity: fm.last_activity,
    has_children: children.length > 0,
  }
}

function childCardFromTask(project: string, doc: TaskDoc) {
  const fm = doc.fm
  const id = String(fm.id || basename(doc.dir))
  return {
    ...nodeFromTask(project, doc),
    has_children: directChildTaskDocs(project, id).length > 0,
    order: typeof fm.order === 'number' ? fm.order : undefined,
    sub_sessions: [],
  }
}

function fallbackStateFromTasks(project: string) {
  const root = projectRoot(project)
  const tasks = projectTasks(project)
  const statuses = tasks.reduce<Record<string, number>>((acc, doc) => {
    const status = String(doc.fm.status || 'todo')
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})
  const domains = tasks
    .filter(doc => doc.fm.type === 'domain')
    .map(doc => ({
      id: String(doc.fm.id),
      title: String(doc.fm.title || doc.fm.id),
      desc: doc.fm.desc || '',
      health: String(doc.fm.health || doc.fm.status || 'active'),
      progress: progress(doc.fm.progress),
      focus: doc.fm.focus,
      last_activity: doc.fm.last_activity,
      priorities: asStringArray(doc.fm.priorities),
      open_questions: asStringArray(doc.fm.open_questions),
      active_tasks: [],
      todo_tasks: [],
      backlog_count: Array.isArray(doc.fm.backlog) ? doc.fm.backlog.length : 0,
      context: doc.fm.context,
      backlog: doc.fm.backlog || [],
    }))

  return {
    project,
    computed: new Date().toISOString(),
    status: String(root?.fm.status || 'active'),
    vision: String(root?.fm.vision || root?.fm.desc || ''),
    horizon: String(root?.fm.horizon || ''),
    goals: asStringArray(root?.fm.goals).map(goal => ({
      id: goal,
      title: goal,
      target: '',
      status: 'in_progress',
      progress: { done: 0, total: 0 },
      done_when: [],
      sub: [],
      tagged_tasks: [],
      tagged_backlog: [],
    })),
    domains,
    tasks_summary: {
      total: tasks.length,
      by_status: statuses,
    },
    alerts: [],
    planning: {
      sprint_focus: String(root?.fm.focus || ''),
      next_actions: [],
      parking_lot: [],
      decisions_pending: asStringArray(root?.fm.open_questions),
    },
  }
}

function stateFromYaml(project: string) {
  const raw = parseYamlFile(`State/projects/${project}/state.yaml`)
  if (!raw) return fallbackStateFromTasks(project)
  const taskState = fallbackStateFromTasks(project)
  return {
    ...taskState,
    project,
    computed: String(raw.updated || new Date().toISOString()),
    status: String(raw.status || taskState.status),
    vision: String(raw.vision || taskState.vision),
    horizon: String(raw.horizon || taskState.horizon),
    goals: asRecords(raw.goals).length > 0 ? asRecords(raw.goals).map(goal => ({
      id: String(goal.id),
      title: String(goal.title || goal.id),
      target: String(goal.target || ''),
      status: String(goal.status || 'in_progress'),
      progress: progress(goal.progress),
      done_when: [],
      sub: asRecords(goal.sub_goals).map(sub => ({
        id: String(sub.id),
        title: String(sub.title || sub.id),
        status: String(sub.status || 'in_progress'),
        progress: progress(sub.progress),
        backlog_count: 0,
        tasks: [],
      })),
      tagged_tasks: [],
      tagged_backlog: [],
    })) : taskState.goals,
    domains: asRecords(raw.domains).length > 0 ? asRecords(raw.domains).map(domain => ({
      id: String(domain.id),
      title: String(domain.title || domain.id),
      desc: '',
      health: String(domain.health || domain.status || 'active'),
      progress: progress(domain.progress),
      active_tasks: [],
      todo_tasks: [],
      backlog_count: 0,
      backlog: [],
    })) : taskState.domains,
    alerts: asRecords(raw.alerts).map(alert => ({
      type: String(alert.type || alert.severity || 'info'),
      severity: String(alert.severity || 'info'),
      detail: String(alert.detail || alert.text || alert.message || ''),
      message: String(alert.message || alert.text || alert.detail || ''),
    })),
  }
}

export function hasLocalVault(): boolean {
  return Object.keys(files).length > 0
}

export function fetchLocalPMProjects() {
  return {
    projects: taskDocs
      .filter(doc => doc.path.match(/^projects\/[^/]+\/task\.md$/))
      .map(doc => ({
        id: String(doc.fm.project_id || doc.dir.split('/')[1]),
        title: String(doc.fm.title || doc.fm.project_id || doc.dir.split('/')[1]),
        type: String(doc.fm.type || 'project'),
        status: String(doc.fm.status || 'active'),
        vision: String(doc.fm.vision || doc.fm.desc || ''),
        has_state: true,
      })),
  }
}

export function fetchLocalSessions(): { sessions: Session[]; count: number; vault_root: string } {
  const byName = new Map<string, Session>()
  for (const doc of taskDocs) {
    for (const id of asStringArray(doc.fm.session_ids)) {
      if (byName.has(id)) continue
      byName.set(id, {
        name: id,
        working_dir: taskWorkingDir(doc.fm.project_id, doc.fm.id),
        vault_root: '',
        jsonl_path: null,
        status: 'ended',
        turns: 0,
        final_message: 'Local vault references this session id, but no transcript file is available.',
        tools_used: [],
        files_changed: [],
        agent_role: 'task-agent',
        task_title: doc.fm.title == null ? null : String(doc.fm.title),
        task_id: doc.fm.id == null ? null : String(doc.fm.id),
        task_path: doc.path,
        runtime: null,
        model: null,
      })
    }
  }
  const sessions = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { sessions, count: sessions.length, vault_root: '' }
}

export function fetchLocalMessages(name: string): { messages: Message[]; last_uuid: string; count: number } {
  const session = fetchLocalSessions().sessions.find(s => s.name === name)
  const label = session?.task_title || session?.task_id || name
  const messages: Message[] = [
    {
      uuid: `${name}-local-user`,
      type: 'user',
      timestamp: new Date(0).toISOString(),
      content: [{ type: 'text', text: `Open local vault session ${name}` }],
    },
    {
      uuid: `${name}-local-note`,
      type: 'assistant',
      timestamp: new Date(0).toISOString(),
      content: [{
        type: 'text',
        text: `Local placeholder for ${label}. The vault frontmatter references session id ${name}, but this frontend-only mode did not find a JSONL transcript to render.`,
      }],
    },
  ]
  return { messages, last_uuid: messages[messages.length - 1].uuid, count: messages.length }
}

export function fetchLocalPMState(project: string) {
  return {
    state: stateFromYaml(project),
    growth_stage: 'full_project',
    is_mock: false,
    source: 'local-vault',
  }
}

export function fetchLocalChildren(project: string, parentId?: string) {
  const parentDoc = parentId ? taskById(project, parentId) : projectRoot(project)
  if (!parentDoc) throw new Error(`Task not found: ${parentId || project}`)
  const parent = nodeFromTask(project, parentDoc)
  const id = String(parentDoc.fm.id || '1')
  return {
    parent,
    children: directChildTaskDocs(project, id).map(doc => childCardFromTask(project, doc)),
    mtime: Date.now(),
  }
}

export function fetchLocalMtime(project: string, nodeId?: string) {
  void project
  void nodeId
  return { mtime: Date.now() }
}

export function resolveLocalTaskPath(project: string, taskId: string) {
  const doc = taskById(project, taskId)
  if (!doc) throw new Error(`Task not found: ${taskId}`)
  return { path: doc.path }
}

export function fetchLocalUserTasks() {
  const raw = files['State/user_queue.json']
  if (!raw) return { tasks: [], pending_count: 0, blocking_count: 0 }
  const parsed = JSON.parse(raw)
  const tasks = Array.isArray(parsed)
    ? parsed as Frontmatter[]
    : parsed && typeof parsed === 'object' && 'tasks' in parsed && Array.isArray(parsed.tasks)
      ? parsed.tasks as Frontmatter[]
      : []
  return {
    tasks,
    pending_count: tasks.filter(task => task.status === 'pending').length,
    blocking_count: tasks.filter(task => task.status === 'pending' && task.urgency === 'blocking').length,
  }
}

export function fetchLocalVaultFile(path: string): VaultFile {
  const content = files[path]
  if (content == null) throw new Error(`File not found: ${path}`)
  const parsed = path.endsWith('.md') ? parseMarkdown(content) : { frontmatter: {}, body: content }
  return {
    path,
    name: basename(path),
    frontmatter: parsed.frontmatter,
    body: parsed.body,
  }
}

export function saveLocalVaultFile(path: string, content: string) {
  void path
  void content
  throw new Error('Local vault fallback is read-only without the backend.')
}

export function fetchLocalVaultTree(root = ''): { tree: TreeNode[] } {
  const rootPath = root.replace(/^\/+|\/+$/g, '')
  const makeNode = (entry: ReturnType<typeof directEntries>[number]): TreeNode => ({
    type: entry.type === 'folder' ? 'dir' : 'file',
    name: entry.name,
    path: entry.path,
    children: entry.type === 'folder' ? directEntries(entry.path).map(makeNode) : undefined,
  })
  return { tree: directEntries(rootPath).map(makeNode) }
}

export function fetchLocalVaultDirectory(path: string) {
  return {
    path,
    entries: directEntries(path).map(entry => ({
      ...entry,
      type: entry.type === 'folder' ? 'dir' as const : 'file' as const,
    })),
  }
}

export function searchLocalVaultFiles(q: string, root = '', limit = 30) {
  const query = q.trim().toLowerCase()
  const results = Object.entries(files)
    .filter(([path, content]) => (!root || path.startsWith(root)) && (!query || path.toLowerCase().includes(query) || content.toLowerCase().includes(query)))
    .map(([path, content]) => ({ name: basename(path), path, size: content.length, mtime: 0 }))
    .slice(0, limit)
  return { results, total: results.length }
}

export function searchLocalVaultDirs(q: string, root = '', limit = 30) {
  const query = q.trim().toLowerCase()
  const dirs = new Set<string>()
  for (const path of Object.keys(files)) {
    if (root && !path.startsWith(root)) continue
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/')
      if (!query || dir.toLowerCase().includes(query)) dirs.add(dir)
    }
  }
  const results = [...dirs].sort().slice(0, limit).map(path => ({ name: basename(path), path }))
  return { results, total: results.length }
}

export function resolveLocalWikilink(target: string) {
  const normalized = target.replace(/^\[\[|\]\]$/g, '').split('|')[0]
  const found = Object.keys(files).find(path =>
    path === normalized ||
    basename(path) === normalized ||
    basename(path).replace(/\.md$/, '') === normalized,
  )
  if (!found) throw new Error(`Link not found: ${target}`)
  return { path: found }
}

export function fetchLocalVaultTasks(): { tasks: VaultPage[] } {
  return {
    tasks: taskDocs.map(doc => ({
      ...doc.fm,
      id: String(doc.fm.id || ''),
      title: String(doc.fm.title || doc.fm.id || ''),
      status: String(doc.fm.status || 'todo'),
      parent: String(doc.fm.parent || ''),
      project_id: String(doc.fm.project_id || ''),
      outcome: doc.fm.outcome == null ? undefined : String(doc.fm.outcome),
      desc: doc.fm.desc == null ? undefined : String(doc.fm.desc),
      file: {
        name: basename(doc.path).replace(/\.md$/, ''),
        path: doc.path,
        link: doc.path.replace(/\.md$/, ''),
      },
    })),
  }
}

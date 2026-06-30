// URL pattern → mock response. Used by install.ts to intercept window.fetch.
//
// Only the handful of endpoints needed to render the home screen / session rail /
// PM view / inbox / settings are mocked. Anything unmatched falls through to
// the real network (which in offline mode will fail silently — usually fine).

import {
  SESSIONS,
  PAST_AGENTS,
  NOTIFICATIONS,
  MESSAGES_BY_SESSION,
  PM_PROJECTS,
  PM_USER_TASKS,
  SPAWNER_HEALTH,
  AUTH_STATUS,
  PROVIDERS,
  LLM_SETTINGS,
  BROWSER_SETTINGS,
} from './fixtures.ts'

type Handler = (url: URL, init?: RequestInit) => unknown | undefined

const methodOf = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase()

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const noop = () => json({ status: 'ok (mock)' })

// ─── PM state per project ─────────────────────────────────────────────────────

const PM_STATE_BY_PROJECT: Record<string, any> = {
  AcmeWebApp: {
    project_id: 'AcmeWebApp',
    title: 'Acme Web App',
    status: 'active',
    vision: 'Customer dashboard that loads <1s, supports 10k sessions by Q3.',
    horizon: 'Q2-Q3 2026',
    goals: [
      {
        id: 'v2-launch',
        title: 'Customer-facing v2 dashboard launched',
        target: '2026-08-15T17:00',
        status: 'in_progress',
        sub_goals: [
          { id: 'design-system-ready', title: 'Design system tokens + components', target: '2026-06-30', progress: '2/3' },
          { id: 'api-ready', title: 'v2 API gateway live', target: '2026-07-15', progress: '1/2' },
          { id: 'soft-launch', title: '10% rollout', target: '2026-08-01', progress: '0/0' },
        ],
      },
      {
        id: 'perf-budget',
        title: 'Hit performance budget on critical paths',
        target: '2026-08-15',
        status: 'in_progress',
        sub_goals: [
          { id: 'baseline-measured', title: 'Establish baseline + CI gate', target: '2026-06-10', progress: '0/1' },
          { id: 'image-pipeline', title: 'AVIF + responsive srcset', target: '2026-07-01', progress: '0/1' },
        ],
      },
    ],
    domains: [
      { id: '1.1', title: 'Frontend — App Shell + Components', status: 'active', progress: '2/3', health: 'active' },
      { id: '1.2', title: 'Backend — API Gateway + Auth', status: 'active', progress: '1/2', health: 'active' },
    ],
    backlog_count: { by_goal: { 'v2-launch': 3, 'perf-budget': 0 }, total: 5 },
    alerts: [
      { severity: 'warn', text: '1.1.3 (app shell) blocked — routing decision made 2026-06-02, re-spawn?' },
      { severity: 'info', text: 'design-system-ready target 2026-06-30; progress 2/3' },
    ],
  },
  ResearchPaper: {
    project_id: 'ResearchPaper',
    title: 'CHI 2027 — Reflective AI Companions',
    status: 'active',
    vision: 'Establish reflective companion as a research direction.',
    horizon: 'Through 2026-09-15',
    goals: [
      {
        id: 'chi-submission',
        title: 'Submit CHI 2027 Papers track',
        target: '2026-09-15T23:59',
        status: 'in_progress',
        sub_goals: [
          { id: 'lit-review-done', title: 'Literature review + framing', target: '2026-07-01', progress: '1/2' },
          { id: 'study-data-collected', title: 'Diary + interviews (N=24)', target: '2026-08-15', progress: '0/1' },
          { id: 'first-full-draft', title: 'First full draft', target: '2026-09-01', progress: '0/1' },
        ],
      },
    ],
    domains: [{ id: '1.1', title: 'Literature Review', status: 'active', progress: '1/2', health: 'active' }],
    backlog_count: { by_goal: { 'chi-submission': 2 }, total: 2 },
    alerts: [{ severity: 'info', text: 'lit-review-done target 2026-07-01; coding 4/13' }],
  },
  MobileLaunch: { project_id: 'MobileLaunch', title: 'Mobile App v1 Launch', status: 'paused', vision: '', goals: [], domains: [], backlog_count: { by_goal: {}, total: 2 }, alerts: [] },
  MarketingSite: { project_id: 'MarketingSite', title: 'Marketing Site Rebuild', status: 'complete', vision: '', goals: [], domains: [], backlog_count: { by_goal: {}, total: 0 }, alerts: [] },
  QuickPrototype: { project_id: 'QuickPrototype', title: 'Visual diff prototype', status: 'active', vision: '', goals: [], domains: [], backlog_count: { by_goal: {}, total: 1 }, alerts: [] },
}

const PM_CHILDREN_BY_PARENT: Record<string, any[]> = {
  'AcmeWebApp:': [
    { id: '1.1', type: 'domain', title: 'Frontend — App Shell + Components', status: 'active', progress: '2/3', health: 'active' },
    { id: '1.2', type: 'domain', title: 'Backend — API Gateway + Auth',      status: 'active', progress: '1/2', health: 'active' },
  ],
  'AcmeWebApp:1.1': [
    { id: '1.1.1', type: 'task', title: 'Define and ship design tokens v1', status: 'done',      goals: ['v2-launch/design-system-ready'] },
    { id: '1.1.2', type: 'task', title: 'Migrate Button + Input + Form primitives', status: 'executing', goals: ['v2-launch/design-system-ready'] },
    { id: '1.1.3', type: 'task', title: 'Build app shell + global navigation', status: 'blocked',  goals: ['v2-launch/design-system-ready'] },
  ],
  'AcmeWebApp:1.2': [
    { id: '1.2.1', type: 'task', title: 'Lock down OpenAPI v2 contracts', status: 'executing', goals: ['v2-launch/api-ready'] },
    { id: '1.2.2', type: 'task', title: 'Session auth — secure cookies + CSRF rotation', status: 'done', goals: ['v2-launch/api-ready'] },
  ],
  'ResearchPaper:': [
    { id: '1.1', type: 'domain', title: 'Literature Review', status: 'active', progress: '1/2', health: 'active' },
    { id: '1.2', type: 'task', title: 'Pilot diary study probe (N=6)', status: 'todo' },
    { id: '1.3', type: 'task', title: 'Paper writing + assembly (LaTeX)', status: 'executing' },
  ],
  'ResearchPaper:1.1': [
    { id: '1.1.1', type: 'task', title: 'Ingest 13 candidate papers', status: 'done' },
    { id: '1.1.2', type: 'task', title: 'Thematic coding of 13 papers', status: 'executing' },
  ],
  'MobileLaunch:': [
    { id: '1.1', type: 'task', title: 'Framework decision spike (RN vs Expo vs native)', status: 'shelved' },
    { id: '1.2', type: 'task', title: 'Mobile design language — initial token mapping',    status: 'dropped' },
  ],
  'MarketingSite:': [
    { id: '1.1', type: 'task', title: 'Astro scaffold + Sanity content model', status: 'done' },
    { id: '1.2', type: 'task', title: 'Migrate 47 WordPress posts to Sanity', status: 'done' },
    { id: '1.3', type: 'task', title: 'Launch + WordPress decommission',      status: 'done' },
  ],
  'QuickPrototype:': [],
}

function mockNodeDetail(project: string, nodeId: string) {
  const state = PM_STATE_BY_PROJECT[project]
  const isProjectRoot = !nodeId
  const child = PM_CHILDREN_BY_PARENT[`${project}:`]?.find(item => item.id === nodeId)
  return {
    id: nodeId || project,
    title: child?.title ?? state?.title ?? project,
    type: isProjectRoot ? 'project' : child?.type ?? 'task',
    desc: child?.desc ?? state?.vision ?? '',
    status: child?.status ?? state?.status ?? 'active',
    path: isProjectRoot ? `projects/${project}/project.md` : `projects/${project}/${nodeId.replaceAll('.', '_')}/task.md`,
    objective: child?.title ?? state?.vision ?? '',
    done_when: [],
    files: [],
    sessions: SESSIONS.filter(s => s.task_id?.endsWith(nodeId)).map(s => ({
      name: s.name,
      status: s.status,
      role: s.agent_role,
      model: s.model,
      display_name: s.display_name,
    })),
    past_sessions: [],
    session_ids: [],
    backlog: [],
    context: {
      purpose: state?.vision ?? 'Mock project context',
      background: [],
      decisions: [],
      references: [],
    },
    open_questions: [],
    priorities: [],
  }
}

function mockChildCard(child: any) {
  return {
    has_children: false,
    files: [],
    sessions: [],
    past_sessions: [],
    session_ids: [],
    ...child,
  }
}

// ─── Handler list ─────────────────────────────────────────────────────────────

const HOME_LAYOUT = {
  version: 1,
  sections: {
    active: { collapsed: false },
    past: { collapsed: false },
  },
  groups: [
    { id: 'role:concierge', label: 'Concierge', kind: 'auto:role', role: 'concierge', collapsed: false, order: 0 },
    { id: 'role:task-agent', label: 'Task agents', kind: 'auto:role', role: 'task-agent', collapsed: false, order: 1 },
    { id: 'role:helper', label: 'Helpers', kind: 'auto:role', role: 'helper', collapsed: false, order: 2 },
    { id: 'role:chainlink', label: 'Chainlink', kind: 'auto:role', role: 'chainlink', collapsed: false, order: 3 },
    { id: 'other', label: 'Other', kind: 'auto:other', collapsed: false, order: 4 },
  ],
  placements: {},
}

const SESSION_CARDS = Object.fromEntries(
  SESSIONS.map(session => [
    session.name,
    {
      glance: session.final_message ?? session.display_name ?? session.name,
      summary: session.task_title ?? session.final_message ?? '',
      status: session.status ?? 'unknown',
      progress: [
        `${session.turns ?? 0} turns`,
        session.model ? `Model: ${session.model}` : 'Mock session',
      ],
      files_edited: session.files_changed ?? [],
      tools_used: session.tools_used ?? [],
      task: session.task_title ?? session.display_name ?? session.name,
      last_updated: session.wrapup_started_at ?? '2026-06-09T11:42:00.000Z',
    },
  ]),
)

const handlers: { match: (u: URL, init?: RequestInit) => boolean; handle: Handler }[] = [
  // Sessions
  { match: (u, init) => u.pathname === '/api/sessions' && u.search === '' && methodOf(init) === 'GET', handle: () => json({ sessions: SESSIONS, count: SESSIONS.length, vault_root: '/home/agent/vault' }) },
  { match: u => /^\/api\/sessions\/[^/]+\/messages$/.test(u.pathname), handle: u => {
    const name = u.pathname.split('/')[3]
    const messages = MESSAGES_BY_SESSION[name] ?? []
    return json({ messages, count: messages.length, last_uuid: null, model: SESSIONS.find(s => s.name === name)?.model ?? null })
  } },
  { match: u => u.pathname === '/api/sessions/cards', handle: () => json({ cards: SESSION_CARDS }) },
  { match: u => u.pathname === '/api/sessions/history/list', handle: () => json({ sessions: PAST_AGENTS, total: PAST_AGENTS.length }) },
  { match: u => u.pathname === '/api/sessions/history', handle: u => {
    const jsonlPath = u.searchParams.get('jsonl_path') ?? ''
    const session = SESSIONS.find(s => s.jsonl_path === jsonlPath || s.name === jsonlPath)
    const messages = session ? MESSAGES_BY_SESSION[session.name] ?? [] : []
    return json({ messages, count: messages.length, last_uuid: null })
  } },
  { match: u => /^\/api\/sessions\/[^/]+\/meta$/.test(u.pathname), handle: u => {
    const name = decodeURIComponent(u.pathname.split('/')[3] ?? '')
    const session = SESSIONS.find(s => s.name === name)
    return json({
      session_name: name,
      working_dir: session?.working_dir ?? '/home/agent/vault',
      jsonl_path: session?.jsonl_path ?? null,
      task_path: session?.task_path ?? null,
      vault_root: session?.vault_root ?? '/home/agent/vault',
      agent_role: session?.agent_role ?? null,
      task_title: session?.task_title ?? session?.display_name ?? null,
    })
  } },
  { match: u => u.pathname === '/api/sessions/past', handle: () => json({ past_agents: PAST_AGENTS, count: PAST_AGENTS.length }) },
  { match: u => /^\/api\/sessions\/[^/]+\/restart$/.test(u.pathname), handle: noop },
  { match: u => /^\/api\/sessions\/[^/]+\/wrapup$/.test(u.pathname), handle: noop },
  { match: u => /^\/api\/sessions\/[^/]+\/(login|login\/code|command|pending-message)$/.test(u.pathname), handle: noop },
  { match: u => u.pathname === '/api/sessions/helper', handle: () => json({ session_name: `helper_${Math.random().toString(16).slice(2, 10)}` }) },
  { match: u => u.pathname === '/api/sessions/concierge', handle: () => json({ session_name: `concierge_${Math.random().toString(16).slice(2, 10)}` }) },
  { match: (u, init) => u.pathname === '/api/sessions' && methodOf(init) !== 'GET', handle: () => json({ session_name: `task_${Math.random().toString(16).slice(2, 10)}` }) },

  // Notifications
  { match: u => u.pathname === '/api/notifications', handle: () => json({ notifications: NOTIFICATIONS }) },
  { match: u => /^\/api\/notifications\/[^/]+\/acknowledge$/.test(u.pathname), handle: noop },

  // Auth / providers
  { match: u => u.pathname === '/api/auth/status', handle: () => json(AUTH_STATUS) },
  { match: u => u.pathname === '/api/auth/login' || u.pathname === '/api/auth/logout', handle: noop },
  { match: u => u.pathname === '/api/providers', handle: () => json(PROVIDERS) },
  { match: u => /^\/api\/providers\/[^/]+\/(login|status|logout)$/.test(u.pathname), handle: () => json({ status: 'ok (mock)', authenticated: true }) },

  // Spawner
  { match: u => u.pathname === '/api/spawner-health', handle: () => json(SPAWNER_HEALTH) },
  { match: u => /^\/api\/spawner-health\/(start|stop)$/.test(u.pathname), handle: noop },

  // Settings
  { match: u => u.pathname === '/api/settings/llm', handle: () => json(LLM_SETTINGS) },
  { match: u => u.pathname === '/api/browser/settings', handle: () => json(BROWSER_SETTINGS) },

  // Home layout
  { match: u => u.pathname === '/api/home/layout', handle: () => json(HOME_LAYOUT) },

  // PM
  { match: u => u.pathname === '/api/pm/projects', handle: () => json({
      projects: PM_PROJECTS.projects.map(p => ({
        id: p.project_id,
        title: p.title,
        type: 'project',
        status: p.status,
        vision: p.vision,
        has_state: true,
      })),
    }),
  },
  { match: u => u.pathname === '/api/pm/state', handle: u => {
    const project = u.searchParams.get('project') ?? ''
    const state = PM_STATE_BY_PROJECT[project]
    return json({ state: state ?? null, growth_stage: 'project', is_mock: true, source: 'mock' })
  } },
  { match: u => u.pathname === '/api/pm/user-tasks', handle: () => {
    const pending = PM_USER_TASKS.tasks.filter(t => t.status === 'pending')
    const blocking = pending.filter(t => t.urgency === 'blocking')
    return json({ tasks: PM_USER_TASKS.tasks, pending_count: pending.length, blocking_count: blocking.length })
  } },
  { match: u => /^\/api\/pm\/user-tasks\/[^/]+\/resolve$/.test(u.pathname), handle: u => {
    const id = u.pathname.split('/')[4]
    return json({ status: 'ok (mock)', task_id: id })
  } },
  { match: u => u.pathname === '/api/pm/children', handle: u => {
    const project = u.searchParams.get('project') ?? ''
    const parentId = u.searchParams.get('parent_id') ?? ''
    const key = `${project}:${parentId}`
    return json({
      parent: mockNodeDetail(project, parentId),
      children: (PM_CHILDREN_BY_PARENT[key] ?? []).map(mockChildCard),
      mtime: Date.now() / 1000,
    })
  } },
  { match: u => u.pathname === '/api/pm/mtime', handle: () => json({ mtime: Date.now() / 1000 }) },
  { match: u => u.pathname === '/api/pm/task-path', handle: u => {
    const project = u.searchParams.get('project') ?? ''
    const taskId = u.searchParams.get('task_id') ?? ''
    const folder = (taskId || '1').split('.').map(s => `${project === '' ? '' : ''}${s}`).join('_')
    return json({ path: `projects/${project}/${folder}/task.md` })
  } },
  { match: u => u.pathname.startsWith('/api/pm/'), handle: noop },

  // Vault — minimal: directory listing returns folders, file returns markdown stub
  { match: u => u.pathname === '/api/vault/tree', handle: () => json({
      tree: {
        type: 'dir', name: 'vault', path: '',
        children: [
          { type: 'dir', name: 'projects', path: 'projects', children: PM_PROJECTS.projects.map(p => ({ type: 'dir', name: p.project_id, path: `projects/${p.project_id}` })) },
          { type: 'dir', name: 'State', path: 'State' },
          { type: 'dir', name: 'Scratch', path: 'Scratch' },
          { type: 'dir', name: '_system', path: '_system' },
        ],
      },
    }),
  },
  { match: u => u.pathname === '/api/vault/directory', handle: u => {
    const path = u.searchParams.get('path') ?? ''
    return json({ path, files: [], directories: [] })
  } },
  { match: u => u.pathname === '/api/vault/file', handle: u => {
    const path = u.searchParams.get('path') ?? ''
    return json({ path, name: path.split('/').pop() ?? path, frontmatter: {}, body: `# Mock file\n\nNo content (mock mode). Real file path would be \`${path}\`.` })
  } },
  { match: u => u.pathname === '/api/vault/resolve', handle: u => json({ path: u.searchParams.get('target') ?? '' }) },
  { match: u => u.pathname === '/api/vault/search' || u.pathname === '/api/vault/search-dirs', handle: () => json({ results: [], total: 0 }) },
  { match: u => u.pathname.startsWith('/api/vault/'), handle: noop },

  // Browser preview — return empty so the BrowserView renders its empty state
  { match: u => u.pathname.startsWith('/api/browser/'), handle: () => json({ ok: true, ready: false }) },

  // Catch-all under /api/ — return empty 200 so the UI doesn't error
  { match: u => u.pathname.startsWith('/api/'), handle: () => json({}) },
]

export function tryHandle(url: URL, init?: RequestInit): Response | undefined {
  for (const h of handlers) {
    if (h.match(url, init)) {
      const result = h.handle(url, init)
      if (result instanceof Response) return result
      if (result === undefined) return undefined
      return json(result)
    }
  }
  return undefined
}

// Fixture data for offline/design-mode runs.
// All times are pegged to a fixed "now" so screenshots stay deterministic.
//
// Sessions cover every status the UI can render:
//   working | idle | waiting_input | login_required | ended | unknown

import type { Session, Message, Notification, PastAgent } from '../lib/types.ts'

export const NOW_ISO = '2026-06-09T11:42:00.000Z'

// ─── Sessions (the rail's source data) ────────────────────────────────────────

export const SESSIONS: Session[] = [
  {
    name: 'concierge_141615d4',
    display_name: 'Concierge',
    agent_role: 'concierge',
    status: 'working',
    working_dir: '/home/agent/vault',
    vault_root: '/home/agent/vault',
    jsonl_path: '/home/agent/.claude/projects/-home-agent-vault/141615d4.jsonl',
    turns: 12,
    final_message: 'Greeting user — surfacing 2 inbox receipts and 1 blocking user task.',
    tools_used: ['Read', 'Bash', 'Write'],
    files_changed: [],
    model: 'claude-opus-4-7',
    total_input_tokens: 24_582,
    total_output_tokens: 3_104,
    runtime: '00:08:21',
  },
  {
    name: 'task_8a21518d',
    display_name: 'Migrate FormField → semantic tokens',
    agent_role: 'task-agent',
    status: 'working',
    working_dir: '/home/agent/vault/projects/AcmeWebApp',
    vault_root: '/home/agent/vault',
    jsonl_path: '/home/agent/.claude/projects/-home-agent-vault-projects-AcmeWebApp/8a21518d.jsonl',
    turns: 47,
    final_message: 'Reading form.tsx to confirm error slot wiring before applying tokens.',
    tools_used: ['Read', 'Edit', 'Bash', 'Grep'],
    files_changed: [
      'src/components/ui/button.tsx',
      'src/components/ui/input.tsx',
      'src/components/ui/form.tsx',
    ],
    task_id: 'AcmeWebApp/1.1.2',
    task_title: 'Migrate Button + Input + Form primitives to tokens',
    task_path: 'projects/AcmeWebApp/1_1/1_1_2/task.md',
    orchestrator_session: 'concierge_141615d4',
    model: 'claude-sonnet-4-6',
    total_input_tokens: 184_201,
    total_output_tokens: 22_847,
    runtime: '01:23:55',
  },
  {
    name: 'task_4b09e7a1',
    display_name: 'OpenAPI v2 spec lockdown',
    agent_role: 'task-agent',
    status: 'idle',
    working_dir: '/home/agent/vault/projects/AcmeWebApp',
    vault_root: '/home/agent/vault',
    jsonl_path: '/home/agent/.claude/projects/-home-agent-vault-projects-AcmeWebApp/4b09e7a1.jsonl',
    turns: 31,
    final_message: 'Spec stable for 6 days. Awaiting sign-off from reviewer.',
    tools_used: ['Read', 'Bash'],
    files_changed: ['projects/AcmeWebApp/1_2/1_2_1/artifacts/openapi.json'],
    task_id: 'AcmeWebApp/1.2.1',
    task_title: 'Lock down OpenAPI v2 contracts',
    task_path: 'projects/AcmeWebApp/1_2/1_2_1/task.md',
    orchestrator_session: 'concierge_141615d4',
    model: 'claude-sonnet-4-6',
    total_input_tokens: 92_104,
    total_output_tokens: 14_322,
    runtime: '00:42:11',
  },
  {
    name: 'task_dee31a09',
    display_name: 'Extend semantic palette',
    agent_role: 'task-agent',
    status: 'waiting_input',
    working_dir: '/home/agent/vault/projects/AcmeWebApp',
    vault_root: '/home/agent/vault',
    jsonl_path: '/home/agent/.claude/projects/-home-agent-vault-projects-AcmeWebApp/dee31a09.jsonl',
    turns: 18,
    final_message: 'Plan ready — proposing success/warn/danger token additions. Blocking on user approval.',
    tools_used: ['Read', 'Write'],
    files_changed: [],
    task_id: 'AcmeWebApp/1.1.1',
    task_title: 'Extend design tokens: add semantic palette',
    task_path: 'projects/AcmeWebApp/1_1/1_1_1/task.md',
    orchestrator_session: 'concierge_141615d4',
    model: 'claude-opus-4-7',
    total_input_tokens: 41_902,
    total_output_tokens: 5_201,
    runtime: '00:14:08',
  },
  {
    name: 'task_b67c0921',
    display_name: 'Auth hardening review',
    agent_role: 'task-agent',
    status: 'ended',
    working_dir: '/home/agent/vault/projects/AcmeWebApp',
    vault_root: '/home/agent/vault',
    jsonl_path: '/home/agent/.claude/projects/-home-agent-vault-projects-AcmeWebApp/b67c0921.jsonl',
    turns: 24,
    final_message: 'Threat model documented. Hardened cookies + CSRF rotation shipped.',
    tools_used: ['Read', 'Edit', 'Bash'],
    files_changed: [
      'server/auth.py',
      'projects/AcmeWebApp/1_2/1_2_2/artifacts/auth_review.md',
    ],
    task_id: 'AcmeWebApp/1.2.2',
    task_title: 'Session auth — secure cookies + CSRF rotation',
    task_path: 'projects/AcmeWebApp/1_2/1_2_2/task.md',
    orchestrator_session: 'concierge_141615d4',
    model: 'claude-sonnet-4-6',
    total_input_tokens: 71_002,
    total_output_tokens: 9_104,
    runtime: '00:36:42',
    wrapup_started_at: '2026-05-17T11:08:00.000Z',
  },
  {
    name: 'task_login_03f1',
    display_name: 'Litreview coder',
    agent_role: 'task-agent',
    status: 'login_required',
    login_provider: 'claude',
    working_dir: '/home/agent/vault/projects/ResearchPaper',
    vault_root: '/home/agent/vault',
    task_id: 'ResearchPaper/1.1.2',
    task_title: 'Thematic coding of 13 papers',
    task_path: 'projects/ResearchPaper/1_1/1_1_2/task.md',
    orchestrator_session: 'concierge_141615d4',
    final_message: 'Claude credentials expired. Re-auth needed before resuming.',
    turns: 0,
    tools_used: [],
    files_changed: [],
  },
  {
    name: 'helper_a4321bdc',
    display_name: 'Helper',
    agent_role: 'helper',
    status: 'idle',
    working_dir: '/home/agent/vault',
    vault_root: '/home/agent/vault',
    final_message: 'Ready. Ask me about the vault or any project.',
    turns: 3,
    tools_used: ['Read'],
    files_changed: [],
    model: 'claude-haiku-4-5-20251001',
    total_input_tokens: 8_104,
    total_output_tokens: 612,
    runtime: '00:02:15',
  },
  {
    name: 'chainlink_5fe70b21',
    display_name: 'Chainlink',
    agent_role: 'chainlink',
    status: 'working',
    working_dir: '/home/agent/vault',
    vault_root: '/home/agent/vault',
    final_message: 'Processing 2 receipts in inbox/, refreshing briefing.',
    turns: 4,
    tools_used: ['Read', 'Write'],
    files_changed: ['State/briefings/current.md'],
    model: 'claude-sonnet-4-6',
    total_input_tokens: 14_400,
    total_output_tokens: 2_104,
    runtime: '00:01:44',
  },
]

// ─── Past agents (for the "Past" rail section) ────────────────────────────────

export const PAST_AGENTS: PastAgent[] = [
  {
    name: 'task_5a92f014',
    session_id: '5a92f014-2b9e-44d3-bd72-0e3e91b88aa1',
    role: 'task-agent',
    project_id: 'AcmeWebApp',
    task_id: 'AcmeWebApp/1.1.1',
    task_title: 'Define and ship design tokens v1',
    ended: '2026-05-04T16:42:00.000Z',
    outcome: 'Shipped 86 tokens across 5 categories. Generator script + Storybook published.',
    task_status: 'done',
    jsonl_path: null,
    working_dir: '/home/agent/vault/projects/AcmeWebApp',
    next_step: null,
    summary: 'Built token JSON, generator, CSS + TS emitters. Migrated app shell + 3 primitives.',
    files_changed: [
      'projects/AcmeWebApp/1_1/1_1_1/artifacts/design_tokens.json',
      'projects/AcmeWebApp/1_1/1_1_1/artifacts/tokens.css',
      'src/styles/tokens.css',
    ],
    errors: null,
    goal_impact: 'Advanced v2-launch/design-system-ready milestone (2/3).',
    shadow_glance: 'Design tokens v1 shipped',
    shadow_summary: '86 tokens, 5 categories, generator deterministic.',
    shadow_status: 'done',
    shadow_progress: ['Inventory', 'Draft JSON', 'Generator', 'App shell', 'Primitives', 'Sign-off'],
    display_title: 'Design tokens v1 shipped',
    deliverables: [
      { path: 'projects/AcmeWebApp/1_1/1_1_1/artifacts/design_tokens.json', desc: 'Token source of truth' },
      { path: 'projects/AcmeWebApp/1_1/1_1_1/artifacts/tokens.css', desc: 'Generated CSS' },
    ],
  },
  {
    name: 'task_c91d7a4e',
    session_id: 'c91d7a4e-aaaa-bbbb-cccc-ddddeeeeffff',
    role: 'task-agent',
    project_id: 'ResearchPaper',
    task_id: 'ResearchPaper/1.1.1',
    task_title: 'Ingest 13 candidate papers to research KB',
    ended: '2026-05-26T22:14:00.000Z',
    outcome: '13 papers ingested. 3 required manual abstract entry due to paywall.',
    task_status: 'done',
    jsonl_path: null,
    working_dir: '/home/agent/vault/projects/ResearchPaper',
    next_step: 'Start thematic coding (1.1.2)',
    summary: 'Bulk paper ingest via vault indexer. KB seeded.',
    files_changed: [
      'projects/ResearchPaper/1_1/1_1_1/artifacts/sources_inventory.json',
      'library/papers/HCI/*.md',
    ],
    errors: null,
    goal_impact: 'Unblocked chi-submission/lit-review-done milestone.',
    shadow_glance: '13 papers ingested',
    shadow_summary: 'KB seeded; 3 manual entries needed.',
    shadow_status: 'done',
    shadow_progress: ['Fetch DOIs', 'Pull PDFs', 'Generate analyses', 'Embed in KB'],
    display_title: 'Research KB seeded with 13 papers',
    deliverables: [
      { path: 'projects/ResearchPaper/1_1/1_1_1/artifacts/sources_inventory.json', desc: 'Per-paper metadata' },
    ],
  },
  {
    name: 'task_2f80aabb',
    session_id: '2f80aabb-1111-2222-3333-444455556666',
    role: 'task-agent',
    project_id: 'MarketingSite',
    task_id: 'MarketingSite/1.3',
    task_title: 'Launch + WordPress decommission',
    ended: '2026-04-22T10:14:00.000Z',
    outcome: 'Zero-downtime cutover 2026-04-22 09:00 UTC. WordPress archived to S3.',
    task_status: 'done',
    jsonl_path: null,
    working_dir: '/home/agent/vault/projects/MarketingSite',
    next_step: null,
    summary: 'DNS cutover + decommission. All checklist items green.',
    files_changed: [
      'projects/MarketingSite/1_3/artifacts/launch_checklist.md',
    ],
    errors: null,
    goal_impact: 'Project complete.',
    shadow_glance: 'Marketing site launched',
    shadow_summary: 'Zero-downtime DNS cutover.',
    shadow_status: 'done',
    shadow_progress: ['DNS prep', 'Vercel promote', 'Cutover', 'Decommission'],
    display_title: 'Marketing site cutover complete',
    deliverables: [
      { path: 'projects/MarketingSite/1_3/artifacts/launch_checklist.md', desc: 'Launch checklist (all green)' },
    ],
  },
  {
    name: 'task_8e44ff03',
    session_id: '8e44ff03-bbbb-cccc-dddd-eeeeffff0000',
    role: 'task-agent',
    project_id: 'AcmeWebApp',
    task_id: 'AcmeWebApp/Scratch/quick-experiment',
    task_title: 'Spike: view-transitions for route changes',
    ended: '2026-05-31T14:09:00.000Z',
    outcome: 'Works in Chrome 117+, Safari 18+. Recommendation: adopt in settings flow first.',
    task_status: 'done',
    jsonl_path: null,
    working_dir: '/home/agent/vault/projects/AcmeWebApp',
    next_step: 'Add settings flow trial behind feature flag',
    summary: 'View transitions API spike — 45m. Demo + notes shipped.',
    files_changed: [
      'projects/AcmeWebApp/Scratch/quick-experiment/artifacts/demo.html',
      'projects/AcmeWebApp/Scratch/quick-experiment/artifacts/notes.md',
    ],
    errors: null,
    goal_impact: null,
    shadow_glance: 'View transitions: viable',
    shadow_summary: '45-min spike; positive recommendation.',
    shadow_status: 'done',
    shadow_progress: ['Demo', 'Test cross-browser', 'Write notes'],
    display_title: 'View transitions spike — viable',
    deliverables: [
      { path: 'projects/AcmeWebApp/Scratch/quick-experiment/artifacts/demo.html', desc: 'Demo page' },
      { path: 'projects/AcmeWebApp/Scratch/quick-experiment/artifacts/notes.md', desc: 'Findings + recommendation' },
    ],
  },
  {
    name: 'task_77ac1de2',
    session_id: '77ac1de2-7777-8888-9999-aaaabbbbcccc',
    role: 'task-agent',
    project_id: 'AcmeWebApp',
    task_id: 'AcmeWebApp/1.1.3',
    task_title: 'Build app shell + global navigation',
    ended: '2026-05-26T09:41:00.000Z',
    outcome: 'Blocked — routing decision deferred.',
    task_status: 'blocked',
    jsonl_path: null,
    working_dir: '/home/agent/vault/projects/AcmeWebApp',
    next_step: 'Resume after TanStack Router vs React Router 7 decision',
    summary: 'Wireframe approved, route skeleton scaffolded. Blocker raised.',
    files_changed: [
      'projects/AcmeWebApp/1_1/1_1_3/artifacts/wireframe.png',
      'src/components/layout/app-shell.tsx',
    ],
    errors: 'Routing library undecided',
    goal_impact: 'Holds up design-system-ready milestone by ~2 weeks if not resolved.',
    shadow_glance: 'App shell: blocked',
    shadow_summary: 'Scaffold ready; routing library undecided.',
    shadow_status: 'blocked',
    shadow_progress: ['Wireframe approved', 'Route skeleton', '— blocked —'],
    display_title: 'App shell — blocked on routing decision',
    deliverables: [],
  },
]

// ─── Notifications ────────────────────────────────────────────────────────────

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'n_001',
    session_name: 'task_dee31a09',
    display_name: 'Extend semantic palette',
    message: 'Awaiting plan approval — 2h estimated work',
    urgency: 'urgent',
    timestamp: '2026-06-09T11:31:00.000Z',
  },
  {
    id: 'n_002',
    session_name: 'task_b67c0921',
    display_name: 'Auth hardening review',
    message: 'Session complete — outcome ready for review',
    urgency: 'normal',
    timestamp: '2026-06-09T10:14:00.000Z',
  },
  {
    id: 'n_003',
    session_name: 'task_login_03f1',
    display_name: 'Litreview coder',
    message: 'Claude credentials expired — re-auth needed',
    urgency: 'urgent',
    timestamp: '2026-06-09T08:02:00.000Z',
  },
]

// ─── Messages per session ─────────────────────────────────────────────────────

const baseUuid = (i: number) => `m-${i.toString().padStart(4, '0')}-aaaa-bbbb-cccc-dddddddddddd`
let mIdx = 0
const m = () => baseUuid(mIdx++)

export const MESSAGES_BY_SESSION: Record<string, Message[]> = {
  concierge_141615d4: [
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T11:34:00.000Z',
      content: [{ type: 'text', text: 'good morning, what should I work on?' }],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T11:34:08.000Z',
      model: 'claude-opus-4-7',
      usage: { input_tokens: 18_410, output_tokens: 218, cache_read_input_tokens: 16_200 },
      content: [
        { type: 'thinking', thinking: 'Briefing is fresh from yesterday. Two receipts unprocessed since the last session — that means chainlink should run. The user queue has a blocking approval item.' },
        {
          type: 'tool_use',
          id: 't1',
          name: 'Read',
          input: { file_path: '/home/agent/vault/State/briefings/current.md' },
        },
      ],
    },
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T11:34:09.000Z',
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: '# Briefing — 2026-06-04\n\n## What changed…' },
      ],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T11:34:14.000Z',
      model: 'claude-opus-4-7',
      usage: { input_tokens: 19_200, output_tokens: 188, cache_read_input_tokens: 18_410 },
      content: [
        {
          type: 'text',
          text: 'Morning! Quick state:\n\n- **Blocking**: AcmeWebApp/1.1.1 needs your approval to extend the semantic palette (2h).\n- **Mid-flight**: 1.1.2 primitives migration — FormField wiring still in progress.\n- **Stale**: 1.1.3 app shell is unblocked (routing decided 06-02) but the agent hasn’t been re-spawned.\n\nWant me to: (A) approve the palette + resume 1.1.2, (B) re-spawn 1.1.3, or (C) something else?',
        },
      ],
    },
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T11:38:00.000Z',
      content: [{ type: 'text', text: 'A please' }],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T11:38:06.000Z',
      model: 'claude-opus-4-7',
      usage: { input_tokens: 19_410, output_tokens: 102 },
      content: [
        { type: 'text', text: 'Approving the palette plan and re-prompting 1.1.2 with the new tokens.' },
        { type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'send_agent_message task_dee31a09 "approved — proceed"' } },
      ],
    },
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T11:38:07.000Z',
      content: [{ type: 'tool_result', tool_use_id: 't2', content: 'sent.' }],
    },
  ],

  task_8a21518d: [
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T10:18:00.000Z',
      content: [
        { type: 'text', text: 'Continue migrating Form primitives. The semantic token additions are coming — wire FormField error state to consume them once they land.' },
      ],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T10:18:11.000Z',
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 12_408, output_tokens: 410 },
      content: [
        { type: 'thinking', thinking: 'Need to inspect form.tsx and see where the error slot currently reads literal colors.' },
        { type: 'tool_use', id: 't10', name: 'Read', input: { file_path: 'src/components/ui/form.tsx' } },
      ],
    },
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T10:18:12.000Z',
      content: [{ type: 'tool_result', tool_use_id: 't10', content: '// FormField source — 142 lines …' }],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T10:18:24.000Z',
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 13_100, output_tokens: 388 },
      content: [
        { type: 'tool_use', id: 't11', name: 'Grep', input: { pattern: '#ef4444|#f59e0b|#16a34a', path: 'src/components/ui' } },
      ],
    },
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T10:18:25.000Z',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 't11',
          content: 'src/components/ui/form.tsx:42: color: #ef4444\nsrc/components/ui/form.tsx:58: border-color: #f59e0b\nsrc/components/ui/badge.tsx:18: background: #16a34a',
        },
      ],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T10:18:33.000Z',
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 13_500, output_tokens: 244 },
      content: [
        { type: 'text', text: '3 call sites use raw colors. Once the semantic tokens land I’ll replace them with `var(--color-danger)`, `var(--color-warn)`, `var(--color-success)` respectively. Waiting on the palette extension to merge.' },
      ],
    },
  ],

  task_dee31a09: [
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T11:18:00.000Z',
      content: [
        { type: 'text', text: 'Add success/warn/danger semantic tokens to the palette and emit the CSS vars.' },
      ],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T11:18:14.000Z',
      model: 'claude-opus-4-7',
      usage: { input_tokens: 8_212, output_tokens: 384 },
      content: [
        { type: 'thinking', thinking: 'Need to read the current token JSON, find where to insert semantic block, then propose the additions before editing.' },
        { type: 'tool_use', id: 't20', name: 'Read', input: { file_path: 'projects/AcmeWebApp/1_1/1_1_1/artifacts/design_tokens.json' } },
      ],
    },
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T11:18:15.000Z',
      content: [{ type: 'tool_result', tool_use_id: 't20', content: '{ "$schema": "...", "color": { ... } }' }],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T11:18:26.000Z',
      model: 'claude-opus-4-7',
      usage: { input_tokens: 8_902, output_tokens: 502 },
      content: [
        {
          type: 'text',
          text: 'Plan:\n\n1. Add to `color.semantic`:\n   - `success-bg`, `success-fg`\n   - `warn-bg`, `warn-fg`\n   - `danger-bg`, `danger-fg`\n2. Regenerate `tokens.css`\n3. Update `STYLE_GUIDE.md`\n\nEstimate: ~2h. **Awaiting approval** before I edit.',
        },
      ],
    },
  ],

  task_4b09e7a1: [
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-03T18:00:00.000Z',
      content: [{ type: 'text', text: 'lock down v2-alpha.7 of the OpenAPI spec; freeze for 7 days.' }],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-03T18:00:09.000Z',
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 5_104, output_tokens: 188 },
      content: [
        { type: 'text', text: 'Spec validated — lint clean. Starting the 7-day no-change window. Will surface immediately if a change request comes in.' },
      ],
    },
  ],

  task_b67c0921: [
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-05-17T10:30:00.000Z',
      content: [{ type: 'text', text: 'audit + harden the session cookie auth before v2 rollout.' }],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-05-17T11:05:00.000Z',
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 22_104, output_tokens: 1_802 },
      content: [
        { type: 'text', text: 'Threat model documented. Mitigations 1–5 shipped; refresh-token rotation deferred to OAuth migration. See artifacts/auth_review.md.' },
      ],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-05-17T11:08:00.000Z',
      model: 'claude-sonnet-4-6',
      isMeta: true,
      subtype: 'task_notification',
      content: [{ type: 'text', text: 'Session complete — wrapup receipt written to State/inbox/.' }],
    },
  ],

  helper_a4321bdc: [
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T11:40:00.000Z',
      content: [{ type: 'text', text: 'where do the briefings live?' }],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T11:40:04.000Z',
      model: 'claude-haiku-4-5-20251001',
      usage: { input_tokens: 1_804, output_tokens: 42 },
      content: [
        { type: 'text', text: '`State/briefings/current.md` — the chainlink agent refreshes it from inbox receipts.' },
      ],
    },
  ],

  chainlink_5fe70b21: [
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T11:41:00.000Z',
      content: [{ type: 'text', text: 'process inbox receipts and refresh the briefing.' }],
    },
    {
      uuid: m(),
      type: 'assistant',
      timestamp: '2026-06-09T11:41:18.000Z',
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 8_402, output_tokens: 122 },
      content: [
        { type: 'tool_use', id: 't40', name: 'Bash', input: { command: 'ls State/inbox/' } },
      ],
    },
    {
      uuid: m(),
      type: 'user',
      timestamp: '2026-06-09T11:41:19.000Z',
      content: [{ type: 'tool_result', tool_use_id: 't40', content: 'receipt_20260603_1820_4b09.md\nreceipt_20260604_1730_8a21.md' }],
    },
  ],
}

// ─── PM (Projects, state, user tasks) ─────────────────────────────────────────

export const PM_PROJECTS = {
  projects: [
    {
      project_id: 'AcmeWebApp',
      title: 'Acme Web App',
      status: 'active',
      last_activity: '2026-06-04',
      progress: { done: 3, total: 6 },
      health: 'active',
      vision: 'Customer dashboard that loads <1s, supports 10k sessions by Q3.',
    },
    {
      project_id: 'ResearchPaper',
      title: 'CHI 2027 — Reflective AI Companions',
      status: 'active',
      last_activity: '2026-06-04',
      progress: { done: 1, total: 4 },
      health: 'active',
      vision: 'Establish reflective companion as a research direction.',
    },
    {
      project_id: 'MobileLaunch',
      title: 'Mobile App v1 Launch',
      status: 'paused',
      last_activity: '2026-05-04',
      progress: { done: 0, total: 2 },
      health: 'stable',
      vision: 'Mobile companion for monitoring; v1 read-only.',
    },
    {
      project_id: 'MarketingSite',
      title: 'Marketing Site Rebuild',
      status: 'complete',
      last_activity: '2026-04-22',
      progress: { done: 3, total: 3 },
      health: 'complete',
      vision: 'Fast, edge-deployed marketing site.',
    },
    {
      project_id: 'QuickPrototype',
      title: 'Visual diff prototype',
      status: 'active',
      last_activity: '2026-06-04',
      progress: { done: 0, total: 1 },
      health: 'active',
      vision: '1-day spike on Playwright + pixelmatch.',
    },
  ],
}

export const PM_USER_TASKS = {
  tasks: [
    {
      id: 'q_20260604_1731_a801',
      type: 'confirm_plan',
      title: 'Approve plan: extend semantic token palette',
      task_id: 'AcmeWebApp/1.1.1',
      context: '2h estimated. Adds success/warn/danger semantic tokens.',
      urgency: 'blocking',
      status: 'pending',
      session_name: 'task_dee31a09',
      files: [
        'projects/AcmeWebApp/1_1/1_1_2/worklog.md',
        'projects/AcmeWebApp/1_1/1_1_1/artifacts/design_tokens.json',
      ],
      created: '2026-06-04T17:31:00',
    },
    {
      id: 'q_20260603_1422_b912',
      type: 'review_artifact',
      title: 'Review: OpenAPI v2-alpha.7 spec',
      task_id: 'AcmeWebApp/1.2.1',
      context: 'Sign off before 7-day stability window starts.',
      urgency: 'non-blocking',
      status: 'pending',
      session_name: 'task_4b09e7a1',
      files: ['projects/AcmeWebApp/1_2/1_2_1/artifacts/openapi.json'],
      created: '2026-06-03T14:22:00',
    },
  ],
}

// ─── Spawner / auth status ────────────────────────────────────────────────────

export const SPAWNER_HEALTH = {
  status: 'running',
  pid: 12345,
  started_at: '2026-06-09T08:30:00.000Z',
  uptime_seconds: 11_400,
  spawn_queue_length: 0,
}

export const AUTH_STATUS = {
  authenticated: true,
  user_id: 'mock_user',
  email: 'design@acme.example',
  role: 'admin',
  provider: 'mock',
}

export const PROVIDERS = {
  providers: [
    { id: 'claude', name: 'Claude', authenticated: true, expires_at: '2026-07-09T00:00:00Z' },
    { id: 'codex', name: 'Codex', authenticated: false, expires_at: null },
  ],
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export const LLM_SETTINGS = {
  default_model: 'claude-sonnet-4-6',
  available_models: [
    { id: 'claude-opus-4-7', label: 'Opus 4.7', tier: 'opus' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', tier: 'sonnet' },
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', tier: 'haiku' },
  ],
  max_tokens: 8192,
}

export const BROWSER_SETTINGS = {
  default_viewport: { width: 1440, height: 900 },
  user_agent: null,
}

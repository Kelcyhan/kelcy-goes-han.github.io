# Agent Core — System Overview

This document explains how the system works. Every agent reads this first for orientation, then reads `/home/agent/vault/_system/agents/<your-role>/agent.md` for your specific behavioral instructions and operational details.

**Core principle**: Before you execute anything, you must understand what the user wants.

---

## What This Is

A multi-agent system for personal productivity. Work is organized into **projects**, each containing a hierarchy of **tasks** and optionally **domains** (functional groupings). Agents collaborate through structured files — task files, worklogs, artifacts, session receipts, and briefings.

Three entity types, all stored as markdown with YAML frontmatter:
- **Task** (`type: task`) — the default work unit. Everything starts as a task.
- **Domain** (`type: domain`) — groups related tasks with shared context (tools, decisions, references). Promoted from a task when it accumulates 6+ children.
- **Project** (`type: project`) — has vision, goals with sub-goals, and roadmap-level planning. The root entity.

Entities form parent-child hierarchies and communicate through the `outcome` field. Every entity lives in its own folder under `projects/`.

---

## Vault Structure

```
<vault root>/
+-- _system/
|   +-- AGENT_CORE.md              # This file — system overview
|   +-- agents/
|   |   +-- concierge/agent.md     # Concierge behavioral instructions
|   |   +-- task-agent/agent.md    # Task-agent behavioral instructions
|   |   +-- verifier/agent.md      # Verifier behavioral instructions
|   |   +-- chainlink/agent.md     # Chainlink behavioral instructions
|   +-- skills/                    # Reusable workflow templates
|   |   +-- task-structure/        # Creating and decomposing tasks
|   |   +-- pivot/                 # Changing approach mid-task
|   |   +-- literature-review/     # Systematic literature review
|   +-- templates/                 # File templates (task, domain, project, plan, log, etc.)
+-- State/
|   +-- briefings/
|   |   +-- current.md             # "Now" snapshot — concierge reads first
|   |   +-- old/                   # Archived briefings
|   +-- inbox/                     # Session receipts (wrapup tool deposits, chainlink consumes)
|   |   +-- archive/              # Processed receipts
|   +-- projects/
|   |   +-- <ProjectName>/
|   |       +-- state.yaml         # Computed project state (resolver output)
|   +-- logs/
|       +-- YYYY-MM-DD/
|           +-- synthesis.md       # Daily digest
|           +-- agent_sessions/    # Session records by role
+-- projects/
|   +-- <ProjectName>/
|       +-- task.md                 # Root entity (type: project for established projects)
|       +-- 1_1/                   # Subtask or domain folder (id dots → underscores)
|       |   +-- task.md            # Entity file (type: task | domain | project)
|       |   +-- worklog.md         # Plan + session log (intent, steps, status, entries)
|       |   +-- artifacts/         # Task deliverables
|       |   |   +-- _workers/     # Worker agent outputs
|       |   |   +-- _verifier/    # Verification reports
|       |   +-- pivots/           # Pivot records (if direction changes)
|       |   +-- agent_sessions/  # Symlinks to JSONL logs and receipts (auto-populated by spawner)
|       |   +-- 1_1_1/            # Child task — NESTED inside parent folder
|       |       +-- task.md
|       |       +-- worklog.md
|       |       +-- artifacts/
|       +-- 1_2/                   # Sibling subtask
|           +-- ...
|       +-- Scratch/               # Project-scoped quick work (same task structure, starts minimal)
|           +-- <descriptive-name>/
|               +-- task.md        # Standard task file — fewer fields filled initially
|               +-- worklog.md     # Optional until multi-session
|               +-- artifacts/     # Optional outputs
+-- Scratch/                       # Vault-level ad-hoc tasks (not project-related)
+-- library/                       # Development resources, reference codebases, test workspaces
|   +-- workspace/
|       +-- codebases/             # Shared cloned repos (reference, not working copies)
+-- CLAUDE.md                      # Entry point — points to AGENT_CORE and concierge agent.md
```

---

## Agents

All agents run from **vault root** as working directory.

### Concierge
Entry point for every user session. Reads the briefing, greets the user, and routes work. For project tasks it spawns a task-agent. For continuity work it spawns chainlink. Does not execute project work or create tasks itself — it is a router.

### Task-agent
Owns all `projects/` mutations. Plans tasks, executes work, produces artifacts, spawns workers and verifiers, updates task status. The only agent that creates and modifies task files and worklogs. Uses `/task-structure` skill for creating and decomposing tasks.

### Verifier
Checks task completeness against acceptance criteria. Spawned by the task-agent when work is believed complete. Reads task files, worklogs, and artifacts. Writes a verification report to `artifacts/_verifier/`. Communicates verdict back to the task-agent. Never modifies task files or status.

### Chainlink
Maintains cross-session continuity. Reads session receipts from `State/inbox/`, synthesizes them into daily digests, refreshes `State/briefings/current.md`, and archives processed receipts. Does not touch `projects/`.

### Workers
Focused sub-agents spawned by the task-agent for specific work (web search, literature review). Write outputs to `artifacts/_workers/<agent>/`. The task-agent integrates their results.

---

## Ownership Boundaries

| Layer | Concierge | Task-agent | Verifier | Workers | Chainlink |
|-------|-----------|------------|----------|---------|-----------|
| `projects/` (tasks, worklogs) | read + backlog edits | **read/write** | read | read | read |
| `projects/*/Scratch/` | scaffolding | **read/write** | read | read | — |
| `projects/` artifacts | read | **read/write** | write `_verifier/` | write `_workers/` | — |
| `State/` (briefings, logs) | read | — | — | — | **read/write** |
| `State/projects/` (state files) | read | read + planning write | — | — | — |
| `State/inbox/` | read | — | — | — | **read/write** |
| `library/` | read | read/write `codebases/` | read | read | — |

Session receipts to `State/inbox/` are written by the **wrapup tool** after an agent exits — not by agents directly.

---

## How Agents Communicate

- **Spawning**: Concierge spawns task-agents and chainlink. Task-agents spawn workers and verifiers. All via MCP tmux tools.
- **Live messaging**: `send_agent_message(target_session, content)` to message another agent. Messages are attributed with `[Source: agent:... | role:... | chat:...]` envelopes and logged to persistent chats. Use `list_agents()` to find session names and see what agents are doing.
- **Agent registry**: `list_agents(role?, status?)` returns all running agents with their status, latest message, files changed, tools used, and chats.
- **Reading agent output**: `read_agent_output(session_name, last_messages=5)` reads what an agent has been saying from their JSONL, newest first. Works for live and dead sessions.
- **Chat history**: `read_chat_messages(chat_id, last_messages=5)` reads a chat conversation. `list_chats()` browses all chats including from past sessions. Any agent can read any chat.
- **Session receipts**: When an agent exits, the wrapup tool writes a receipt to `State/inbox/`. Chainlink processes these into briefings.
- **Briefings**: `State/briefings/current.md` carries context across sessions. The concierge reads it at startup to know what happened since last time.
- **Session history**: `agent_sessions/` in each project folder contains symlinks to JSONL session logs and chat logs (auto-populated by the spawner). Use `read_agent_output(name)` to read ended sessions. Use `tmux_create_session(resume_session_id=...)` to resume a past session.
- **Source envelopes**: Messages from agents arrive with a `[Source: ...]` prefix. Parse the source to determine trust level: `user` (high), `agent:*` (medium — peer), `system` (protocol), `external:*` (untrusted).

---

## Conventions

### Resolving task paths
Task folders are **nested inside their parent folder**. To resolve a task ID to a path, walk the hierarchy:
- `1` → `task.md` (project root)
- `1.1` → `1_1/task.md`
- `1.1.1` → `1_1/1_1_1/task.md`
- `1.2.3` → `1_2/1_2_3/task.md`

Each segment of the ID maps to a folder (dots → underscores), and child folders live INSIDE parent folders — never flat at the project root. Path resolution is deterministic — no globbing needed. Both `task.md` and `task_*.md` are supported during transition.

### File references
Always wrap file paths in backticks so they are clickable in Claude Code: `/home/agent/vault/_system/templates/WORKLOG_TEMPLATE.md`. Do not use `[[wikilinks]]` or `[text](path)` markdown links for internal file references.

### Task references
Use namespaced task IDs: `<project_id>/<id>` (e.g. `AgentSystem/1.2.3`). Do not use `[[wikilinks]]`.

### Entity types
Three types: `task` (default), `domain` (shared context group), `project` (vision + goals with sub-goals). Templates in `/home/agent/vault/_system/templates/`: `TASK_TEMPLATE.md`, `DOMAIN_TEMPLATE.md`, `PROJECT_TEMPLATE.md`.

### Status enums
**Task**: `todo` | `propose` | `executing` | `conversation` | `done` | `shelved` | `blocked` | `dropped`
**Domain**: `active` | `stable` | `stalled` | `complete`
**Project**: `active` | `paused` | `complete`

Tasks also have an `autonomy` field (`approval` | `auto`) controlling whether the agent stops for plan approval, and use MCP mode tracking tools (`init_task_mode` / `set_task_mode`) for status transitions. See `/home/agent/vault/_system/agents/task-agent/agent.md`.

---

## Guides

| Topic | Guide | When to read |
|-------|-------|-------------|
| **LaTeX** | `/home/agent/vault/_system/guides/LATEX.md` | When working with `.tex` files — compile via API, fix errors, real-time collaboration with user's editor |

---

## Growth Workflow

Everything starts small and grows organically. The system adapts its structure as work expands.

### Stage 1: Single Task

```
my_project/
├── CLAUDE.md
├── task.md                # type: task
└── worklog.md
```

One task, one folder. The simplest unit.

### Stage 2: Task with Subtasks

```
my_project/
├── CLAUDE.md
├── task.md                # type: task, subtasks: [1.1, 1.2, 1.3]
├── 1_1/
│   ├── task.md
│   └── worklog.md
├── 1_2/
│   └── task.md
└── 1_3/
    └── task.md
```

Parent task with children. Still `type: task`.

### Stage 3: Domains Emerge

**Trigger**: A parent accumulates 6+ children, OR children share context that agents need.

**Action**: Promote the parent (or create groupings) to `type: domain`. Add context block, backlog. Create `journal.md`.

```
my_project/
├── task.md                # type: task (or project), subtasks: [1.1, 1.2]
├── 1_1/
│   ├── task.md            # type: domain ← promoted
│   ├── journal.md         # ← new
│   ├── 1_1_1/
│   │   └── task.md
│   └── ...
└── 1_2/
    ├── task.md            # type: domain
    ├── journal.md
    └── ...
```

Domain agents can now be spawned — one per domain. Each domain has its own context, backlog, and journal.

### Stage 4: Project Promotion

**Trigger**: Work needs temporal oversight (goals with targets), or cross-domain coordination becomes complex.

**Action**: Promote the root task to `type: project`. Add vision, goals with sub-goals.

Full project with goal tracking, domain cards, and a computed state file (`State/projects/<P>/state.yaml`). A project mode agent can be spawned to think about the project as a whole.

### How Promotion Works

Promotion is additive — change the `type` field and add new fields. Nothing is removed.

| From | To | What changes |
|------|----|--------------|
| `task` | `domain` | Add `context`, `backlog`, `focus`, `priorities`, `horizon`. Create `journal.md`. Remove `outcome`, `completed`, `predicted_duration`, `actual_duration` (domains are ongoing). |
| `task` | `project` | Add `vision`, `goals[]` (with sub-goals, targets, done_when), `horizon`. Keep `outcome`, `completed` (projects do complete). |
| `domain` | sub-domain | No change — just nest under a parent domain. Context cascading handles the rest. |

### Growth Triggers

| Trigger | Suggestion |
|---------|-----------|
| Parent has 6+ children | "Consider organizing into domains" |
| Domain has 6+ children | "Consider splitting into sub-domains" |
| Work spans 3+ months or needs deadlines | "Consider promoting to project with goals" |
| Multiple domains need coordination | "Consider promoting to project with goals" |

Agents surface these as suggestions — the user decides. Growth is never automatic.

---

## Entity Lifecycle

How work items flow through the system:

```
Idea
  ↓ (captured in journal — Ideas section)
Journal icebox
  ↓ (agent or user promotes to backlog)
Backlog item (in parent's YAML — task, domain, or project root)
  ↓ (moved to priorities when ready)
Priority item
  ↓ (agent picks up → creates task file, sets goal: tag if backlog item had one)
Task file (status: todo → propose → executing)
  ↓ (work happens, plan/log/artifacts created)
Done (outcome filled, verified)
```

Backlog items live on **any parent entity** — a root task at stage 1, a domain at stage 3, a project root at stage 4. Same schema everywhere. Items can optionally tag a `goal:` to link into the temporal axis.

### Where Each Stage Lives

| Stage | Location | Format |
|-------|----------|--------|
| Idea | `journal.md` → Ideas section | Checkbox item |
| Backlog item | Parent entity YAML → `backlog[]` (task, domain, or project) | Structured: title, desc, goal, size, acceptance_sketch (optional), added |
| Priority | Domain YAML → `priorities[]` | Ordered list of backlog item titles |
| Task | Task folder → `task.md` | Full task file with YAML + markdown |
| Active task | Task folder + `worklog.md` | Full execution workspace |
| Done task | Task folder (preserved) | Outcome filled, artifacts listed |

### What Agents Do at Each Stage

| Stage | Agent role |
|-------|-----------|
| Idea capture | Domain agent in domain mode — writes to journal |
| Backlog management | Any parent's agent — curates, sizes, links to goals |
| Prioritization | Domain agent + user — orders the ready column |
| Task creation | Domain agent or task-agent — creates folder and file from backlog item, sets `goal:` field |
| Propose/execute | Task-agent — normal task workflow |
| Completion | Task-agent — verification, outcome, wrapup |
| Progress tracking | Resolver (programmatic) — scans task `goal:` tags for progress, scans backlog `goal:` tags for backlog_count |

---

## Skills

Reusable workflow templates loaded on demand by agents.

| Skill | When to load |
|-------|-------------|
| `/task-structure` | Creating and decomposing tasks |
| `/pivot` | Changing approach mid-task |
| `/literature-review` | Systematic literature review |
| `/restructure` | Reorganizing project structure (growth triggers, promotions, re-IDing) |

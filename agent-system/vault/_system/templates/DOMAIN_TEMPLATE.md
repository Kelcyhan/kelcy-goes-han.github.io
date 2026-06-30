# Domain Template

A domain groups related tasks with shared context. It represents a managed area of work — a functional area, a research theme, a chapter, a component — with its own planning lifecycle.

**Promotion path**: Change `type: task` to `type: domain` and add the context, strategy, and backlog fields below. Existing subtasks become domain children.

**When to create**: When a parent task has 6+ children, or when tasks share context (tools, methods, decisions, references) that agents need before starting any task in the area.

**Nesting**: Domains can contain sub-domains. A domain's `subtasks` list can reference both tasks and other domains — the child's `type` field determines what it is. The same growth trigger applies: if a domain accumulates 6+ direct children, propose splitting into sub-domains.

**The domain agent**: When a task-agent is spawned to "think about" a domain (rather than execute a specific task), the domain folder IS the agent's workspace. The domain file is its desk, child tasks are its team's work, and `journal.md` is its persistent thinking space. See agent.md "Domain Mode" for the full workflow.

---

````markdown
---
project_id: "<project_id>"
id: "<parent_id>.<n>"
type: domain
title: "<Domain Name>"
desc: "<What this domain covers>"
status: active          # active | stable | stalled | complete
parent: "<parent_id>"
owner: [user, agent]

# Context — what an agent needs to work in this area
context:
  purpose: "<Why this domain exists — one sentence>"
  background: []        # what you need to know to work here
    # - "React 19 + Vite + TypeScript"          (software)
    # - "PRISMA protocol for systematic review"  (research)
    # - "Target audience: academic researchers"  (writing)
  decisions: []         # key choices made that constrain future work
    # - "Chose dockview for tab management"      (software)
    # - "Excluded pre-2020 papers"               (research)
  references: []        # things to read before working here (3-5 max)
    # - "artifacts/architecture.md"
    # - "1.8 UX Research synthesis"

open_questions: []
  # - "Should we use OAuth or invite-based auth?"
  # - "Which benchmark is most representative?"

# Backlog — planned work that hasn't become task files yet
backlog:
  # - title: "<Work item title>"
  #   desc: "<What this involves and why — 2-3 sentences>"
  #   goals: []                     # goal IDs or goal/milestone (optional), e.g. ["system-v1/pm-layer"]
  #   est_hours: null               # estimated hours
  #   acceptance_sketch: []         # rough criteria, refined when picked up
  #     # - "<what done looks like>"
  #   added: YYYY-MM-DD

# Strategy
focus: "<Current priority — one line>"
priorities: []          # ordered list of backlog item titles — the "ready" column (3-5 max)
  # - "Set up API endpoint for auth"
  # - "Write integration tests for dashboard"
horizon: "<rough timeframe>"

# Lifecycle
started: ""             # YYYY-MM-DD
last_activity: ""       # YYYY-MM-DD

# Computed (updated programmatically)
progress: "0/0"         # "{done}/{total}" from children
health: active          # active | stable | stalled | complete

subtasks: []
session_ids: []
summary: ""             # filled on completion — what was accomplished, key decisions, lessons learned
updated: YYYY-MM-DD
---
````

---

## Domain Folder Structure

The domain folder IS the domain agent's workspace:

```
1_3/
├── task.md                 # This domain file — the agent's "desk"
├── journal.md              # Persistent thinking space (see JOURNAL_TEMPLATE.md)
├── 1_3_1/                  # Child task (created from backlog when work starts)
│   ├── task.md
│   ├── worklog.md
│   └── artifacts/
├── 1_3_2/                  # Could be a sub-domain
│   ├── task.md             # type: domain
│   ├── journal.md
│   └── ...
└── artifacts/              # Domain-level artifacts (shared across tasks)
```

**Key**: Task files are created when work starts, NOT as backlog. Backlog items live in the parent's YAML and become task folders when an agent picks them up.

---

## Lifecycle Fields

Domains intentionally omit `completed`, `predicted_duration`, and `actual_duration`. Unlike tasks, domains are ongoing functional areas — they don't have a target duration or a single completion date. They have `started` and `last_activity` for staleness detection.

## Domain Status

`status` is set by agents. `health` is computed programmatically and may override `status` for dashboard display (e.g., agent sets `active` but no child has activity for 14+ days → computed health shows `stalled`).

| Status | Meaning |
|--------|---------|
| `active` | At least one child task is active |
| `stable` | Has todo items but nothing active — waiting |
| `stalled` | All active children have no activity for 14+ days |
| `complete` | All children done or dropped |

## Context Block

The `context` block is the agent's cheat sheet. When spawned into a domain, agents read this first.

- **`background`**: What you need to know. General term — covers tech stacks, methodologies, style guides, contractor info.
- **`decisions`**: Key choices that constrain future work. "Why is it this way?" Prevents re-examining settled questions.
- **`references`**: Things to read before working. 3-5 items max.
- **`open_questions`**: Unresolved questions and unknowns. Natural flow: open_questions → (answered) → decisions.

## Backlog

The backlog is where planned work lives before becoming task files. Items are lightweight — title, description, hour estimate, and which goals they serve. The `backlog[]` field uses the same schema on tasks, domains, and projects — any parent entity can hold backlog items.

**Flow**: Idea → journal icebox → backlog item → picked up → task file created → active → done

- **`desc`**: 2-3 sentences. Enough for an agent to understand what the work involves and write a good plan when picking it up. Not just a title restated.
- **`acceptance_sketch`**: Optional rough criteria. These get refined into proper "Done When" items on the task file. Helps the agent scope the work before committing.
- **`goals`**: Optional. Which goals this work contributes to (list). Helps the domain agent reason about goal progress and prioritize accordingly. The resolver scans these tags to consolidate tagged backlog into state.yaml per goal.
- **`priorities[]`**: The "ready" column. An ordered list of 3-5 backlog item titles that should be worked on next. The domain agent manages this list.
- **`est_hours`**: Estimated hours of work. Used by the resolver for schedule math. Leave null if unknown — the resolver will flag it.

When an agent picks up a backlog item:
1. Create a task folder and task file (using TASK_TEMPLATE.md)
2. Set `goals:` on the new task from the backlog item's goals field
3. Remove the item from `backlog` (or mark it — the task file replaces it)
4. Enter propose mode for the new task

## Sub-domains and Context Cascading

Domains can nest. Example: domain "Frontend" → sub-domain "Dashboard" + sub-domain "Mobile".

**Context cascading**: When an agent is spawned into a sub-domain, it reads context up the parent chain:
1. Project root → vision, goals
2. Parent domain → context (background, decisions, references)
3. Sub-domain → its own context (overrides/extends parent)

Sub-domains don't repeat parent context — they only add what's specific to their area. For example, parent "Frontend" has `background: ["React 19", "Tailwind"]`. Sub-domain "Dashboard" adds `background: ["dockview for tabs"]` — the agent reads both.

**Health computation**: Parent domain health accounts for the full subtree. If a sub-domain is stalled, it affects the parent. The `progress` field counts all leaf descendants, not just direct children.

**When to sub-domain**: Same growth trigger as tasks — 6+ direct children, or when children have clearly distinct contexts that would benefit from separate cheat sheets.

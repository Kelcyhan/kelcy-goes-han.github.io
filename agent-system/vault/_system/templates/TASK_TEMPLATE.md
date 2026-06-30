# Task Template

A task is the default work unit. Everything starts as a task. When a task grows (6+ children), the agent may suggest promoting it to a domain or project.

**Status enum**: `todo` | `propose` | `executing` | `conversation` | `done` | `shelved` | `blocked` | `dropped`

**When task files are created**: Task files are created when work is about to start — when an agent or user picks up work and enters propose mode. Planned work that isn't ready yet lives as backlog items in the parent entity's YAML (task, domain, or project), NOT as task files. This prevents stale task files with outdated plans.

**The `todo` status**: Means "committed work, not yet started" — post-decomposition subtasks that exist as files but haven't been picked up yet. It does NOT mean "backlog item." Backlog items are lighter-weight and live in the parent's `backlog[]`.

---

````markdown
---
project_id: "<project_id>"
id: "<parent_id>.<n>"
type: task
title: "<Task Title>"
desc: "<What this task accomplishes>"
status: todo              # todo | propose | executing | conversation | done | shelved | blocked | dropped
autonomy: ""              # approval | auto — set at spawn time, managed by MCP (default: approval)
parent: "<parent_id>"
owner: [user, agent]    # who is responsible — user, agent, or both

# Goal connection (optional — which goals this task serves)
goals: []               # goal IDs or goal/milestone, e.g. ["system-v1", "system-v1/protocols-tested"]

# Estimate
est_hours: null           # numeric — estimated hours of work remaining
  # small task: 2-4h, medium: 8-16h, large: 24h+
  # set in propose mode, updated during execution if scope changes

# Lifecycle — use YYYY-MM-DD or YYYY-MM-DDTHH:MM for precision
started: ""             # set when status -> executing (first time)
completed: ""           # set when status -> done
last_activity: ""       # updated on any work
actual_duration: ""     # filled on completion for future calibration

session_ids: []
subtasks: []            # PARENT ONLY — remove for leaf tasks
backlog: []             # PARENT ONLY — planned children not yet task files
  # - title: "<Work item>"
  #   desc: "<What this involves — 2-3 sentences>"
  #   goals: []                     # goal IDs this serves (optional)
  #   est_hours: null               # estimated hours
  #   acceptance_sketch: []         # rough criteria, refined when picked up
  #     # - "<what done looks like>"
  #   added: YYYY-MM-DD
order: 10
artifacts: []
verification: []
  # - text: "<How to check this is done — operationalize when possible>"
  #   done: false
outcome: ""              # filled on completion — supports markdown
updated: YYYY-MM-DD
---
````

---

## Usage Notes

1. **Leaf task**: Remove `subtasks` and `backlog` from YAML
2. **Parent task**: Clear `verification` (children define completion). Use `backlog[]` for planned children that aren't task files yet.
3. **Scratch task** (`projects/<P>/Scratch/<name>/`): Remove `id`, `parent`, `order`, `subtasks`, `backlog`, `deps`, `goals` from YAML. `worklog.md` still expected. When the item grows into a real task, add back `id`/`parent`/`order` and move it into the main hierarchy.
4. **Goal tagging**: Set `goals` to the list of goal IDs this task contributes to, e.g. `["paper-deadline"]`. Leave empty for maintenance/cleanup tasks. A task can serve multiple goals. The temporal ordering lives on the goal's `sequence`, not here.
5. **Estimation**: Set `est_hours` in propose mode. Update during execution if scope changes significantly. The resolver uses this for schedule math — missing estimates default to 4h and generate alerts.
8. **Scope extension**: `verification` can be extended mid-task when the user requests additional work that builds on the current task's output (e.g., "now implement it" after a proposal). The agent transitions to `propose`, updates `verification`, `desc`, and `est_hours`, then follows the normal autonomy gate. See "Task Extension" in task-agent/agent.md.
6. **Artifacts**: Plain list of path + description. No tiers — just list what exists.
7. **Backlog**: Same schema on tasks, domains, and projects. Backlog items on any entity can have a `goals:` tag — the resolver scans all areal entities and consolidates tagged backlog into state.yaml per goal.
7. **Autonomy**: Controls plan approval. `approval` = plan + blocking user approval before execution. `auto` = execute immediately, notify user at inflection points. Set by the concierge at spawn time via MCP. If unset, treated as `approval`.

## When Task Files Get Created

| Situation | What happens |
|-----------|-------------|
| **Idea surfaces** | Goes into `journal.md` (Ideas/icebox section) |
| **Idea is worth doing** | Promoted to parent's `backlog[]` in YAML — title, desc, goals, est_hours |
| **Ready to work on** | Moved to parent's `priorities[]` — the "ready" column |
| **Agent picks it up** | Task folder + task file created, goal set from backlog item, agent enters propose mode |
| **Decomposition** | Parent task creates child task files — children start as `todo` |

The key insight: a task file represents a commitment. It has a folder, will get a worklog, and an agent will work on it. Don't create task files for "maybe later" items.

## Status Transitions

Status is managed by the `init_task_mode` and `set_task_mode` MCP tools. Never edit the `status` field directly.

```
todo → propose → executing ⇄ conversation → done
          ↑         |                |          |
          |      blocked          propose ←─────┘
          |         |            (reopen / new work)
          |      shelved
          |         |
          └──── dropped
```

| Status | Meaning |
|--------|---------|
| `todo` | Committed work, not yet picked up |
| `propose` | Agent is researching and writing plan (no execution) |
| `executing` | Working through plan steps |
| `conversation` | Interacting with user (mid-plan input or post-completion) |
| `done` | Complete — outcome filled |
| `shelved` | Consciously paused — "not now, maybe later" |
| `blocked` | Cannot progress, waiting on something external |
| `dropped` | Abandoned or replaced |

## Autonomy Levels

The `autonomy` field controls whether the agent stops for plan approval. Set by the concierge at spawn time via the `autonomy` parameter on `spawn_task_agent`.

| Level | Plan approval | Replanning | Decomposition |
|-------|--------------|------------|---------------|
| `approval` | Blocking — auto-queued for user approval | Blocking | Always blocking |
| `auto` | Skip — execute immediately, user notified | Notify, keep working | Always blocking |

If unset, defaults to `approval`.

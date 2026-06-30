# Task Data Model

Complete YAML schema for task/domain/project files.

All structured data lives in YAML frontmatter. Task files have no required body sections — everything is in YAML.

---

## Task Fields

```yaml
# --- Required ---
project_id: "AgentSystem"    # Project namespace
id: "1.2.3"                  # Pure numeric, dot-separated
type: task                   # task | domain | project
title: "Task name"
desc: "What this task accomplishes"
status: todo                 # todo | propose | executing | conversation | done | shelved | blocked | dropped
parent: "1.2"               # Parent task ID
owner: [user, agent]         # who is responsible

# --- Content (all in YAML, supports markdown via | literal block) ---
objective: |
  What this task accomplishes and why it matters.
  Supports full markdown including headers, lists, code blocks.
done_when:                   # Completion checklist
  - text: "Criterion 1"
    done: false
  - text: "Criterion 2"
    done: true
outcome: ""                  # Result summary (filled on completion, supports markdown)

# --- Metadata ---
autonomy: approval           # approval | auto
goals: []                    # goal IDs or goal/milestone, e.g. ["system-v1/protocols-tested"]
est_hours: null              # estimated hours remaining
deps: []                     # task IDs that must complete first
order: 10                    # sort order within parent

# --- Lifecycle ---
started: ""                  # YYYY-MM-DD
completed: ""                # set when done
last_activity: ""
actual_duration: ""

# --- Hierarchy (parent tasks only) ---
subtasks: []                 # child task IDs
backlog: []                  # planned children not yet task files
  # - title: "Work item"
  #   desc: "What this involves"
  #   goals: []
  #   est_hours: null
  #   added: YYYY-MM-DD

# --- Session tracking ---
session_ids: []
artifacts: []
updated: YYYY-MM-DD
```

---

## Domain Fields (extends task)

Domains add context, strategy, and backlog management:

```yaml
type: domain
status: active               # active | stable | stalled | complete

# --- Context (agent cheat sheet) ---
context:
  purpose: "Why this domain exists"
  background: []             # what you need to know
  decisions: []              # key choices made
  references: []             # things to read (3-5 max)

# --- Strategy ---
focus: "Current priority"
priorities: []               # ordered backlog titles (ready column)
horizon: "Q1 2026"
open_questions: []

# --- Computed ---
progress: "0/0"              # done/total from children
health: active               # computed from children
summary: ""                  # filled on completion
```

Domains do NOT have: `outcome`, `completed`, `actual_duration`, `done_when`, `autonomy`

---

## Project Fields (extends task)

```yaml
type: project
status: active               # active | paused | complete

vision: "What success looks like"
horizon: "Q1-Q3 2026"
goals: []                    # goal file IDs (see GOAL_TEMPLATE.md)
open_questions: []
outcome: ""                  # filled on completion
```

---

## Status Values

### Task Status
| Status | Meaning |
|--------|---------|
| `todo` | Committed work, not yet picked up |
| `propose` | Agent writing plan (no execution) |
| `executing` | Working through plan steps |
| `conversation` | Interacting with user |
| `done` | Complete — outcome filled |
| `shelved` | Paused — not now, maybe later |
| `blocked` | Cannot proceed |
| `dropped` | Abandoned |

### Domain Status
| Status | Meaning |
|--------|---------|
| `active` | At least one child active |
| `stable` | Has todo items, nothing active |
| `stalled` | No activity for 14+ days |
| `complete` | All children done/dropped |

---

## ID Scheme

IDs are pure numeric, dot-separated:

| ID | Meaning |
|----|---------|
| `1` | Root task (project level) |
| `1.1` | First child of root |
| `1.1.3` | Third child of 1.1 |

Folder names: dots → underscores, ID only (`1.2.3` → `1_2_3/`)

---

## Task Folder Structure

```
task_folder/
+-- task.md                   # Task file (all fields in YAML frontmatter)
+-- worklog.md                # Plan + session log (intent, steps, status, entries)
+-- agent_sessions/           # Session records
+-- artifacts/
|   +-- _workers/             # Worker agent outputs
|   +-- _verifier/            # Verification reports
+-- pivots/                   # Pivot records
```

> **Backward compatibility**: Both `task.md` and `task_*.md` are supported during transition.

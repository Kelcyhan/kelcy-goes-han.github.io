# Project Template

A project is a task that grew up. It has a vision, goals, and enough scope to warrant roadmap-level planning. Projects emerge from tasks that accumulate complexity.

**Promotion path**: Change `type: task` to `type: project` and add the strategy fields below. Existing fields remain unchanged.

**When to skip goals**: Small projects (< 6 tasks) don't need goals. Set `goals: []`. Add goals later when temporal oversight becomes useful.

---

````markdown
---
project_id: "<project_id>"
id: "1"
type: project
title: "<Project Name>"
desc: "<One-line description>"
status: active          # active | paused | complete
owner: [user, agent]

# Strategy
vision: "<What success looks like — one sentence>"
horizon: "<rough timeframe, e.g. 'Q1-Q3 2026' or '6 months'>"

# Goals — references to goal files (see GOAL_TEMPLATE.md)
goals: []
  # - "paper-deadline"    # references goals/goal_paper_deadline.md
  # - "system-v1"         # references goals/goal_system_v1.md

open_questions: []
  # - "Unresolved question or decision that affects the project"

# Lifecycle
started: ""
completed: ""
last_activity: ""
actual_duration: ""

subtasks: []
backlog: []
  # - title: "<Work item title>"
  #   desc: "<What this involves and why — 2-3 sentences>"
  #   goals: []                     # goal IDs this serves (optional)
  #   est_hours: null               # estimated hours
  #   acceptance_sketch: []
  #   added: YYYY-MM-DD
session_ids: []
outcome: ""              # filled on completion — supports markdown
updated: YYYY-MM-DD
---
````

---

## Goal Model

Goals are a **temporal view** over areal work items. They live in `goals/` under the project root as separate files (see GOAL_TEMPLATE.md). The project root just lists goal IDs.

**Two independent views:**
- **Areal DAG** (file hierarchy): project → domains → tasks. WHERE work lives.
- **Temporal view** (goal files): target dates + ordering over selected tasks. WHEN work is due.

For simple projects with ≤ 2 goals, you can embed goals directly in the YAML instead of separate files:

```yaml
goals:
  - id: prototype
    title: "Working prototype"
    target: "2026-02-27T17:00"
    done_when:
      - "Can demo the full cycle"
```

But once a goal needs a sequence or observations → promote to a goal file.

## Project Status

| Status | Meaning |
|--------|---------|
| `active` | Work in progress |
| `paused` | Consciously on hold |
| `complete` | All goals achieved, vision met |

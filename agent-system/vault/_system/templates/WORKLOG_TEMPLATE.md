# Worklog Template

Copy the skeleton below into `worklog.md` at the task root. Fill in the placeholders.

Replaces both `plan.md` and `log.md`. Full YAML frontmatter, no markdown body.

The task file says WHAT (desc, verification, goals). The worklog is the agent's plan and execution log: discovered constraints, action steps, scope boundaries, session entries. The agent should be able to work from the worklog + task.md alone during execution.

---

````markdown
---
type: worklog
task: "<project_id>/<id>"
project_id: "<project_id>"
task_id: "<id>"
updated: YYYY-MM-DD HH:MM

# ── Agent's Understanding (written in propose mode, reviewed by user) ──

# Goal context — how this task fits into the bigger picture
# (Task file has goals: ["goal-id"] — just IDs. This carries the agent's
# understanding of WHY this task matters. Persists across context compression.)
goal_context:
  goal: ""                   # goal title
  target: ""                 # deadline (from goal file)
  milestone: ""              # milestone title (if applicable)
  contribution: ""           # one sentence: how this task advances the goal

# Constraints — boundaries the agent discovered during planning
# (Surface boundaries that aren't obvious from desc. Examples:
# "Frontend-only — don't touch backend"; "User does not want to publish papers";
# "Migration must avoid the live data path." Leave empty if no extra boundaries.)
constraints:
  - ""

# ── Operational State ──

# Status — single source of truth for operational state
current_step: 0             # integer index, 0-based
status:
  done: ""                  # what's been completed
  remains: ""               # what's left
  next: ""                  # single next action
  blockers: null            # null or string
  pending_user_tasks: null  # queued items waiting for human, or null
  key_files:                # important files for next session context
    - path: ""
      desc: ""

# Context — what to read to understand this task (keep tight)
context:
  read_first:               # files the agent should load on resume
    - "task.md"
    - "worklog.md"
  other:                    # external sources, related artifacts, reference docs
    - ""

# ── Plan ──

steps:
  - text: "1. <action> -> <expected output>"
    done: false
    owner: agent             # agent | user | together
    phase: "Phase Name"      # optional grouping, null if flat list

scope:
  in:
    - "What's included"
  out:
    - "What's excluded"
  # On scope extension: move items from out → in, add new items to in.
  # Log the change in entries with a decision note.

# Agents / Skills — who does what
agents:
  primary: task-agent
  workers:                   # spawned sub-agents for focused work
    - name: ""
      purpose: ""
  skills: []                 # skills to invoke (e.g., literature-review, pivot)

# When to contact user — task-specific escalation triggers
contact_user:
  - "Material plan deviation (scope/approach change)"
  - "Structural changes (new tasks, reorg, pivot)"
  - "Missing access or ambiguous decision"

# ── Log — session entries (newest first) ──

entries:
  - ts: "YYYY-MM-DDTHH:MM"
    title: "Short description"
    session: "<claude-uuid>"
    what_happened:
      - "Did X"
      - "Did Y"
    decisions:
      - "Decided Z because..."
    files_touched:
      - "path/to/file.ext"
    next: "What comes after this"
---
````

---
name: restructure
description: "Reorganize project structure: audit and normalize outdated files, group tasks into domains, promote entities, re-ID children. Use when the user explicitly asks to reorganize, promote, or restructure — this is a destructive operation that moves and renames files, so confirm the plan with the user before executing."
allowed-tools: Read Write Edit Grep Glob Bash(mv *) Bash(git mv *)
---

# Restructure Protocol

Restructuring changes project shape while preserving all work. **Always propose to user before making structural changes.**

**References:**
- `/home/agent/vault/_system/templates/TASK_TEMPLATE.md` — Current task schema
- `/home/agent/vault/_system/templates/DOMAIN_TEMPLATE.md` — Domain schema (promotion target)
- `/home/agent/vault/_system/templates/PROJECT_TEMPLATE.md` — Project schema (promotion target)
- `/home/agent/vault/_system/templates/JOURNAL_TEMPLATE.md` — Created alongside new domains

---

## When to Load This Skill

- User accepts a growth trigger: "yes, organize into domains"
- User asks to reorganize: "regroup these tasks", "clean up the structure"
- Agent identifies structural issues during a planning session
- Project structure is outdated (Obsidian wikilinks, missing fields, wrong `type`)

---

## Principles

1. **Propose, don't act** — All structural changes need user approval
2. **Additive promotion** — Change `type` and add fields; don't lose existing data
3. **Preserve work** — Move and rename, never delete content
4. **Fix references** — Every move requires updating all back-references (parent, deps, subtasks)
5. **One workflow at a time** — Don't combine audit + promotion + re-ID in one pass. Do them sequentially.

---

## Pre-Flight Checklist

Before ANY restructure operation:

- [ ] Read the project root task file — understand current structure, subtasks list
- [ ] Read all affected task files — know what you're moving/changing
- [ ] Read the relevant templates — know the target schema
- [ ] Identify all cross-references — which files reference the affected tasks (deps, subtasks, parent)
- [ ] Draft the proposal — what will change, what the result looks like
- [ ] Present to user with before/after view
- [ ] Get explicit confirmation

---

## Workflow 1: Audit & Normalize

Bring an outdated project structure into compliance with current templates. This is often the first step before any other restructure operation.

**Read first:** `/home/agent/vault/_system/templates/TASK_TEMPLATE.md`, `/home/agent/vault/_system/templates/DOMAIN_TEMPLATE.md`, `/home/agent/vault/_system/templates/PROJECT_TEMPLATE.md` — compare each file's fields against the matching template.

### What to Check

| Check | Outdated pattern | Current pattern |
|-------|-----------------|-----------------|
| Subtask references | `"[[AgentSystem/1.1]]"` (Obsidian wikilinks) | `"AgentSystem/1.1"` (plain strings) |
| `aliases` field | `aliases: ["AgentSystem/1"]` | Remove — not used |
| DataviewJS blocks | ` ```dataviewjs ... ``` ` | Remove entirely |
| `type` field | Missing or wrong (e.g., `type: task` on a 15-child parent) | Set correctly: `task`, `domain`, or `project` |
| Missing fields | No `project_id`, no `type`, no `backlog` | Add per template |
| Stale fields | `outcome: "TBD"` on a parent that should be a domain | Remove task-only fields on domains |
| Body sections | Obsidian-specific (DataviewJS breadcrumbs, callouts) | Plain markdown sections per template |

### Steps

1. **Scan all task files** in the project — list each file's current YAML fields
2. **Compare against templates** — for each file, what's missing, what's stale, what's wrong?
3. **Draft a normalization report** — table of files and what changes are needed
4. **Propose to user** — "Here's what I'd fix. Approve?"
5. **On approval, fix each file:**
   - Strip Obsidian wikilinks from `subtasks` and `deps` (remove `[[` and `]]`)
   - Remove `aliases` field
   - Remove DataviewJS blocks from markdown body
   - Add missing YAML fields with defaults from template
   - Remove stale fields that don't belong on this entity type
   - Update body sections to match template structure
6. **Verify** — re-scan all files, confirm no broken references

### Example: Normalizing subtask references

**Before** (Obsidian-era):
```yaml
subtasks:
  - "[[AgentSystem/1.1]]"
  - "[[AgentSystem/1.2]]"
  - "[[AgentSystem/1.3]]"
```

**After** (current):
```yaml
subtasks:
  - "AgentSystem/1.1"
  - "AgentSystem/1.2"
  - "AgentSystem/1.3"
```

### Example: Removing DataviewJS

**Before** (body of task file):
````
```dataviewjs
// Automatic breadcrumb generator
const current = dv.current();
// ... 30 lines of JS
```
````

**After**: Section removed entirely. No replacement needed — agents read YAML directly.

---

## Workflow 2: Group Children into Domains

When a parent has 6+ children that cluster into natural groups.

**Read first:** `/home/agent/vault/_system/templates/DOMAIN_TEMPLATE.md` (new domain schema), `/home/agent/vault/_system/templates/JOURNAL_TEMPLATE.md` (created alongside each domain).

### When to Use

- Growth trigger: "Parent X has 6+ children"
- User says: "these tasks should be grouped"
- You notice related tasks that share context (tools, methods, themes)

### Steps

1. **Read all child task files** — titles, descriptions, statuses, relationships
2. **Identify clusters** — look for shared context:
   - Same functional area (frontend, backend, infrastructure)
   - Same theme (research, design, implementation)
   - Same goal tag
   - Shared dependencies
3. **Propose groupings** to user:
   ```
   I'd group the 12 children of AgentSystem/1 into 3 domains:

   **Core Infrastructure** (1.1):
   - 1.1.1 MCP Spawner (was 1.3)
   - 1.1.2 Inter-Agent Comms (was 1.13)
   - 1.1.3 Session Continuity (was 1.9)

   **User Experience** (1.2):
   - 1.2.1 Agent Dashboard (was 1.6)
   - 1.2.2 Dashboard UX Research (was 1.8)
   - 1.2.3 Voice Coding (was 1.7)

   **Design & Research** (1.3):
   - 1.3.1 Vision (was 1.1)
   - 1.3.2 Memory Architecture (was 1.10)
   - 1.3.3 PM Layer (was 1.15)

   This means re-IDing all children. Proceed?
   ```
4. **On approval, for each new domain:**
   a. Create domain folder: `1_1/`
   b. Create domain file: `task.md` with `type: domain`
      - Fill `context` block (purpose, background, decisions, references)
      - Set `status: active` (or appropriate)
      - Set `subtasks` to the children being moved in
      - Set `parent` to the project root ID
   c. Create `journal.md` from JOURNAL_TEMPLATE
5. **Move children** into domain folders (see Workflow 5: Re-ID)
6. **Update project root** — set `subtasks` to the new domain IDs
7. **Run post-flight checklist**

### Example: Before and After

**Before:**
```
my_project/
+-- task.md                     # type: task, 12 children
+-- 1_1/
+-- 1_2/
+-- 1_3/
+-- 1_4/
+-- 1_5/
+-- 1_6/
+-- ...
```

**After:**
```
my_project/
+-- task.md                     # type: project (promoted), 3 domain children
+-- 1_1/
|   +-- task.md                 # type: domain
|   +-- journal.md
|   +-- 1_1_1/                  # was 1_1
|   +-- 1_1_2/                  # was 1_2
|   +-- 1_1_3/                  # was 1_6
+-- 1_2/
|   +-- task.md                 # type: domain
|   +-- journal.md
|   +-- 1_2_1/                  # was 1_3
|   +-- 1_2_2/                  # was 1_4
+-- 1_3/
    +-- task.md                 # type: domain
    +-- journal.md
    +-- 1_3_1/                  # was 1_5
```

---

## Workflow 3: Promote Task to Domain

Change a parent task into a domain. Used when a task accumulates children that share context.

**Read first:** `/home/agent/vault/_system/templates/DOMAIN_TEMPLATE.md` (target schema — all fields to add), `/home/agent/vault/_system/templates/JOURNAL_TEMPLATE.md` (create alongside).

### What Changes

| Action | Detail |
|--------|--------|
| Change `type` | `task` -> `domain` |
| Add `context` block | `purpose`, `background`, `decisions`, `references` |
| Add `backlog` | `[]` (or migrate existing backlog items) |
| Add `focus` | Current priority — one line |
| Add `priorities` | `[]` — ordered ready column |
| Add `horizon` | Rough timeframe |
| Add `open_questions` | `[]` |
| Remove `outcome` | Domains don't complete with an outcome |
| Remove `completed` | Domains don't have a completion date |
| Remove `predicted_duration` | Domains are ongoing |
| Remove `actual_duration` | Domains are ongoing |
| Add `progress` | `"0/0"` — computed from children |
| Add `health` | `active` — computed from children |
| Create `journal.md` | From JOURNAL_TEMPLATE |
| Update YAML fields | Replace task fields (objective, done_when) with domain fields (context, focus, priorities, etc.) |

### Steps

1. **Read the task file** — understand current state, children, status
2. **Draft the domain file** — show user what the promoted version looks like
3. **Propose to user** — "I'll promote task X to a domain. Here's the new file."
4. **On approval:**
   a. Update YAML frontmatter — change `type`, add new fields, remove task-only fields:
      - Move `objective` content to `context.purpose`
      - Remove `done_when` (children define completion)
      - Add `context` block (purpose, background, decisions, references)
      - Add `open_questions`, `focus`, `priorities`, `horizon`
      - Add `summary: ""` (filled on completion)
   b. Remove any remaining body sections (all data now in YAML)
   c. Create `journal.md` alongside the domain file:
      ```markdown
      # Domain Journal — <Domain Name>

      ## Observations

      ## Ideas
      - [ ] ...

      ## Concerns

      ## Conversation Notes
      ```
   d. Update parent's reference if needed (parent subtasks still point to same ID)
5. **Verify** — domain file has all required fields, journal exists

### Example

**Before** (`1_2/task.md`):
```yaml
---
project_id: "MyProject"
id: "1.2"
type: task
title: "Frontend"
desc: "Frontend components and user interface"
status: active
parent: "1"
outcome: "TBD"
objective: |
  Build the frontend components.
done_when:
  - text: "All components implemented"
    done: false
subtasks:
  - "MyProject/1.2.1"
  - "MyProject/1.2.2"
  - "MyProject/1.2.3"
---
```

**After** (`1_2/task.md`):
```yaml
---
project_id: "MyProject"
id: "1.2"
type: domain
title: "Frontend"
desc: "Frontend components and user interface"
status: active
parent: "1"
owner: [user, agent]
context:
  purpose: "Build and maintain all user-facing UI components"
  background:
    - "React 19 + Vite + TypeScript"
    - "Tailwind for styling"
  decisions: []
  references: []
open_questions: []
backlog: []
focus: "Complete component library"
priorities: []
horizon: "Q1 2026"
started: "2026-02-15"
last_activity: "2026-02-28"
progress: "1/3"
health: active
subtasks:
  - "MyProject/1.2.1"
  - "MyProject/1.2.2"
  - "MyProject/1.2.3"
session_ids: []
summary: ""
updated: 2026-02-28
---
```

---

## Workflow 4: Promote Task to Project

Change the root task into a project. Used when work needs temporal oversight (goals with targets) or cross-domain coordination.

**Read first:** `/home/agent/vault/_system/templates/PROJECT_TEMPLATE.md` (target schema — all fields to add, goal model, sub-goal structure).

### What Changes

| Action | Detail |
|--------|--------|
| Change `type` | `task` -> `project` |
| Add `vision` | What success looks like — one sentence |
| Add `goals[]` | Goals with sub-goals and targets |
| Add `horizon` | Rough timeframe |
| Add `open_questions` | `[]` |
| Add `backlog` | `[]` (or keep existing) |
| Add `backlog` | `[]` (or keep existing) |
| Add computed fields | `domain_count: 0`, `task_count: 0`, `done_count: 0` |
| Keep `outcome` | Projects do complete |
| Keep `completed` | Projects have a completion date |
| Update body | Add Vision, Domains, Open Questions sections |

### Steps

1. **Read the root task** — understand scope, children, existing work
2. **Read child tasks** — understand what goals would make sense
3. **Propose initial goals** based on the existing work:
   ```
   Based on the current work, I'd suggest these goals:

   Goal: "Working prototype" (target: March 2026)
     - Sub-goal: "ui-ready" — Dashboard renders project state
     - Sub-goal: "agent-flow" — Agent spawning works reliably

   Goal: "System documentation" (target: April 2026)
     - Sub-goal: "core-docs" — Agent protocols documented
     - Sub-goal: "user-guide" — Setup and usage guide

   These are initial — we'll refine as we go.
   ```
4. **On approval:**
   a. Update YAML — change `type`, add `vision`, `goals`, `horizon`, computed fields
   b. Update body — add Vision, Domains, Open Questions sections
   c. Remove stale body sections (DataviewJS, old breadcrumbs)
5. **Tag existing tasks with goals** — for each task, set `goal:` to the appropriate sub-goal ID
6. **Verify** — project file has all required fields, goals reference real sub-goal IDs

### Example

**Before** (`task.md`):
```yaml
---
project_id: "MyProject"
id: "1"
type: task
title: "My Project"
status: active
subtasks:
  - "MyProject/1.1"
  - "MyProject/1.2"
outcome: "TBD"
---
```

**After** (`task.md`):
```yaml
---
project_id: "MyProject"
id: "1"
type: project
title: "My Project"
desc: "Build a personal productivity tool"
status: active
owner: [user, agent]
vision: "A tool that helps manage daily tasks with AI assistance"
horizon: "Q1-Q2 2026"
goals:
  - id: mvp
    title: "Minimum viable product"
    target: "2026-03-15"
    done_when:
      - "Core task CRUD works"
      - "Agent can create and complete tasks"
    sub:
      - id: backend-ready
        title: "API endpoints functional"
      - id: ui-ready
        title: "Basic UI renders tasks"
open_questions: []
started: "2026-01-15"
completed: ""
last_activity: "2026-02-28"
predicted_duration: "6m"
actual_duration: ""
domain_count: 0
task_count: 2
done_count: 0
subtasks:
  - "MyProject/1.1"
  - "MyProject/1.2"
backlog: []
session_ids: []
updated: 2026-02-28
---

## Vision
A tool that helps manage daily tasks with AI assistance, using structured agents
for planning and execution.

## Domains

## Open Questions

## Outcome
*To be filled when complete*
```

---

## Workflow 5: Re-ID Children (Move Tasks)

When tasks move between parents, their IDs, folder names, and all references must update.

### What Changes Per Moved Task

| Item | Update |
|------|--------|
| Folder name | Rename: `1_3/` -> `1_1_2/` |
| Task file `id` field | `"1.3"` -> `"1.1.2"` |
| Task file `parent` field | `"1"` -> `"1.1"` |
| Old parent `subtasks[]` | Remove the moved task's reference |
| New parent `subtasks[]` | Add the moved task's reference |
| Any `deps[]` referencing this task | Update the ID everywhere |
| Grandchildren `id` and `parent` | Recursively update (1.3.1 -> 1.1.2.1, etc.) |
| Grandchildren folder names | Recursively rename |

### Steps

1. **Map the moves** — for each task being moved, record:
   - Current ID, new ID
   - Current folder path, new folder path
   - Current parent, new parent
2. **Scan for cross-references** — grep the project for every old ID
   ```
   # For each old ID, find all files that reference it
   grep -r "1.3" --include="*.md" project_root/
   ```
3. **Propose the full move plan** to user:
   ```
   Moving 3 tasks:
   - 1.3 -> 1.1.2 (auth, into backend domain)
     - 1.3.1 -> 1.1.2.1 (child)
   - 1.5 -> 1.2.1 (docs, into frontend domain)

   References to update: 7 files
   ```
4. **On approval, execute in order:**
   a. **Rename folders** — bottom-up (children first, then parents) to avoid path conflicts
   b. **Update task files** — `id`, `parent` fields on every moved file
   c. **Update parent subtasks** — remove from old parent, add to new parent
   d. **Update deps** — any file with `deps:` referencing a moved task
   e. **Update subtasks of moved parents** — if a parent task was moved, its `subtasks[]` entries need new ID prefixes
5. **Verify** — every ID in every `subtasks[]` and `deps[]` field points to a real file

### Example

**Moving task 1.3 (auth) into domain 1.1 (backend) as 1.1.2:**

Files to update:
```
1_3/task.md                     -> 1_1/1_1_2/task.md
  id: "1.3" -> "1.1.2"
  parent: "1" -> "1.1"

1_3/1_3_1/                      -> 1_1/1_1_2/1_1_2_1/
  task.md:
    id: "1.3.1" -> "1.1.2.1"
    parent: "1.3" -> "1.1.2"

task.md:                        (old parent — project root)
  subtasks: remove "MyProject/1.3"

1_1/task.md:                    (new parent — backend domain)
  subtasks: add "MyProject/1.1.2"

1_4/task.md:                    (has dep on auth)
  deps: "AgentSystem/1.3" -> "AgentSystem/1.1.2"
```

### Handling Subtask Numbering Gaps

After moving tasks out of a parent, IDs may have gaps (1.1, 1.3, 1.5 — missing 1.2 and 1.4). Two options:

1. **Leave gaps** (simpler) — IDs don't need to be sequential. Past session logs and receipts reference old IDs, so renumbering creates more churn.
2. **Renumber** (cleaner) — only if doing a major restructure and no past sessions reference the old IDs.

**Default: leave gaps.** Only renumber if the user specifically asks for it.

---

## Post-Flight Checklist

After ANY restructure operation:

- [ ] Every `subtasks[]` entry points to a real task file (no orphaned references)
- [ ] Every task file's `parent` field points to a real parent file
- [ ] Every `deps[]` entry references a valid task ID
- [ ] No task file is orphaned (exists on disk but not in any parent's `subtasks[]`)
- [ ] All new domain files have `journal.md` alongside them
- [ ] Subtask references use plain strings (no `[[wikilinks]]`)
- [ ] No DataviewJS blocks remain in any modified file
- [ ] No `aliases` field remains in any modified file
- [ ] YAML fields match the expected template for each entity type
- [ ] User has been shown the final structure
- [ ] Run resolver to regenerate state file (if one exists)

### Verification Procedure

```
1. List all task/domain/project files in the project
2. For each file:
   a. Check type field exists and is valid
   b. Check parent field points to a real file (or empty for root)
   c. Check each subtask reference resolves to a real file
   d. Check each dep reference resolves to a real file
3. List all folders that contain a task.md file (or task_*.md during transition)
4. Confirm every such folder is referenced in some parent's subtasks[]
5. Report: "X files checked, Y issues found" (or "all clean")
```

---

## What This Skill Does NOT Cover

- **Content changes** — rewriting objectives, plans, logs, outcomes
- **Deleting tasks** — only moving/reorganizing (use `dropped` status instead)
- **Automatic decisions** — ALWAYS proposes to user first
- **State file generation** — that's the resolver's job (run it after restructure)
- **Backlog item migration** — moving items between backlogs (handle manually)

---

## Combining Workflows

Common multi-step restructure scenarios:

### "Modernize this project" (outdated -> current)
1. **Audit & Normalize** (Workflow 1) — fix wikilinks, remove Obsidian artifacts, add missing fields
2. **Promote root to project** (Workflow 4) — add vision, goals
3. **Group into domains** (Workflow 2) — cluster children, create domains
4. **Re-ID children** (Workflow 5) — move tasks into domain folders

### "This domain is too big" (domain splitting)
1. **Group into sub-domains** (Workflow 2) — same as grouping, but parent is a domain not project
2. **Re-ID children** (Workflow 5) — move tasks into sub-domain folders

### "Promote this task" (single entity growth)
1. **Promote to domain** (Workflow 3) — if it has children needing shared context
2. **Promote to project** (Workflow 4) — if it needs temporal oversight

Always do **Audit & Normalize first** if the project has any outdated patterns. It's much easier to restructure clean files.

---

## Checklist Summary

Before completing any restructure, verify:

- [ ] User approved every structural change
- [ ] All affected files updated (YAML + body)
- [ ] All cross-references valid (subtasks, deps, parent)
- [ ] No orphaned tasks (every file referenced by a parent)
- [ ] New domains have journal.md
- [ ] No Obsidian artifacts remain (wikilinks, aliases, DataviewJS)
- [ ] User shown the final structure

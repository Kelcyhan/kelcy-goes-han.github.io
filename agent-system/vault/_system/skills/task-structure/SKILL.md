---
name: task-structure
description: "Create, decompose, and restructure tasks in the agent task system. Use when: (1) Creating a new project or task, (2) Decomposing a task into subtasks, (3) Completing a parent task by synthesizing child outcomes, (4) Modifying task hierarchy or structure."
allowed-tools: Read Grep Glob Write
---

# Task Structure Operations

This skill covers creating and modifying task hierarchy.

**References:**
- `/home/agent/vault/_system/templates/TASK_TEMPLATE.md` — Copy-paste template for new tasks
- `/home/agent/vault/_system/skills/task-structure/references/data-model.md` — Full YAML schema

---

## Creating a New Task

> **CRITICAL REMINDER**: After creating any subtask, you MUST update the parent task's `subtasks` field to include a link to the new subtask. This is not optional.

> **PARENT TASK UPDATE IS MANDATORY**: Every single time you create a subtask, the final step is ALWAYS to update the parent task's `subtasks` field.

1. **Determine parent task** — Where does this task belong?

2. **Generate ID** — `{parent_id}.{next_number}`
   - Parent is `1.2` with children `1.2.1`, `1.2.2` -> new task is `1.2.3`
   - Root task of a project is `1`

3. **Create folder** — nested inside the parent folder
   - Convert id dots to underscores: `1.2.3` -> `1_2_3`
   - Place INSIDE parent: `1_2/1_2_3/` (not flat at project root)
   - Example: parent `1.2` lives at `1_2/`, child `1.2.3` lives at `1_2/1_2_3/`

4. **Create task file** — `task.md`
   - Path is deterministic: `{id_underscored}/task.md`

5. **Copy template** — Use `/home/agent/vault/_system/templates/TASK_TEMPLATE.md` as base
   - Remove sections marked `<!-- LEAF ONLY -->` for parent tasks
   - Remove sections marked `<!-- PARENT ONLY -->` for leaf tasks
   - Fill YAML frontmatter (see `/home/agent/vault/_system/skills/task-structure/references/data-model.md` for all fields)

   > **Critical v3 requirements**:
   > - Always set `project_id`
   > - Always use namespaced aliases: `"<project_id>/<id>"`
   > - Always include `type: task`
   > - Always include `session_ids: []`

6. **Update parent task** — **CRITICAL - DO NOT SKIP THIS STEP**

   a. **Read the parent task file** to get current `subtasks` list
   b. **Add the new subtask link** using namespaced alias:
      ```yaml
      subtasks:
        - "[[StudyRoam/1.2.1]]"
        - "[[StudyRoam/1.2.2]]"
        - "[[StudyRoam/1.2.3]]"    # New subtask
      ```
   c. **Use Edit tool** to update the parent task file
   d. **Verify the update** by reading the parent task again

7. **Confirm with user** before creating

---

## Task Types and Sections

### Leaf Task (No Subtasks)

All structured data lives in YAML frontmatter:

| YAML Field | Purpose |
|------------|---------|
| `objective` | What this task accomplishes (supports markdown via `\|` literal block) |
| `done_when` | Completion checklist — list of `{text, done}` items |
| `outcome` | Result summary (filled when done, supports markdown) |
| `artifacts` | References to outputs in `artifacts/` subfolder |

### Parent Task (Has Subtasks)

| YAML Field | Purpose |
|------------|---------|
| `objective` | What this parent task accomplishes |
| `subtasks` | List of child task IDs |
| `backlog` | Planned children not yet task files |
| `outcome` | Synthesized from subtask outcomes |

---

## Decomposing a Task

### When to Decompose

Create subtasks when **context cannot stay focused on the outcome**:
- **Context dilution** — Too much diverse information competes for attention
- **Multiple sessions** — Work needs resumable checkpoints
- **Parallelization** — Independent parts could run simultaneously
- **User approval gates** — User must review before continuing

### When NOT to Decompose

Keep as one task when:
- All information directly serves the outcome (focused context)
- Completable in one session
- Steps share state and are naturally sequential
- No approval needed mid-task

### Decomposition Procedure

1. **Analyze the task** — Determine if decomposition is needed
2. **Propose to user** — Show proposed subtasks with descriptions
3. **Wait for confirmation**
4. **For each subtask** — Follow "Creating a New Task" procedure above
5. **Update parent task** — Add all subtask links, set parent status to `active`

---

## Completing a Parent Task

1. **Verify** — All subtasks have `status: done`
2. **Read subtask outcomes** — Gather all `outcome` fields
3. **Synthesize** — Create coherent summary
4. **Fill parent outcome**
5. **Ask user** — "All subtasks complete. Proposed parent outcome: [X]. Mark as done?"
6. **Update status** — Change to `done`

---

## Task Folder Structure

```
task_folder/
+-- task.md                   # Task file (all fields in YAML frontmatter)
+-- worklog.md                # Plan + session log (intent, steps, status, entries)
+-- agent_sessions/           # tmux-spawned agent session records
+-- artifacts/                # Task deliverables
|   +-- _workers/             # Worker agent outputs
|   +-- _verifier/            # Verification reports
+-- pivots/                   # Pivot records
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Task folder | `{id_underscored}/` | `1_1/` |
| Task file | `task.md` | `1_1/task.md` |
| Worklog | `worklog.md` (at task root) | `1_1/worklog.md` |
| Artifacts folder | `artifacts/` (inside task folder) | `1_1/artifacts/` |

> **Backward compatibility**: Both `task.md` and `task_*.md` are supported during transition.

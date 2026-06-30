---
name: pivot
description: "Execute a pivot when current approach won't work. Use when: (1) Current approach demonstrably failed, (2) New information invalidates the plan, (3) A significantly better approach is discovered. Pivots require user approval and preserve all previous work."
allowed-tools: Read Write Edit
---

# Pivot Protocol

Pivots change direction while preserving history. **Always ask user before pivoting.**

---

## When to Pivot

Pivot when:
- Current approach **demonstrably** won't work (not just difficult)
- New information **invalidates** the plan
- A **significantly better** approach is discovered

**Do NOT pivot** for minor adjustments or normal iteration.

---

## Pivot Principles

1. **Rename, don't delete** — Pivoted work gets `pivot_` prefix
2. **Document the why** — Pivot records capture reasoning
3. **Link to evidence** — Reference what triggered the pivot
4. **User approval** — Always ask before pivoting

---

## Pivot Execution Steps

### 1. Propose to User

```
I need to pivot task [X].

**Problem**: [What's wrong with current approach]

**Evidence**: [Link to artifact/finding that triggered this]

**Proposed new approach**: [Brief description]

Proceed with pivot?
```

### 2. Create Pivot Record

Create `pivots/PV-YYYY-MM-DD.md` in the parent task's folder:

```yaml
---
type: pivot
id: PV-2026-01-29
title: "Pivot: brief description"
triggered_by: [[artifact_or_task_that_caused_pivot]]
affects: [[parent_task_id]]
decision: "What we decided to do instead"
evidence:
  - [[artifact_showing_problem]]
created: 2026-01-29
---

# Pivot: [Title]

## Context
What was happening when we discovered the need to pivot.

## Why We Pivoted
Evidence and reasoning for the change.

## What Changed
- **Old approach**: [description]
- **New approach**: [description]

## Preserved Work
Links to valuable artifacts from the pivoted work that remain useful.
```

### 3. Rename Old Folder

Add `pivot_` prefix to the old task folder:

```
subtask_name/  →  pivot_subtask_name/
```

### 4. Update Old Task

Set status to `dropped`:

```yaml
status: dropped
```

### 5. Create Replacement Task

Create new folder and task file:
- New ID (next available under parent)
- New folder: `{id_underscored}/`
- New file: `task.md`
- Clear objective reflecting new approach

### 6. Update Parent Task

**YAML changes**:
```yaml
subtasks:
  - [[1.1]]
  - [[1.3]]           # New task (1.2 was pivoted)
pivots:
  - [[PV-2026-01-29]]
```

**Add markdown section** (if not exists):
```markdown
## Pivot History

> [!warning] [[PV-2026-01-29]]: Approach X abandoned
> Original approach failed due to [reason]. Replaced with [new approach].
> See pivot record for full details and evidence.
```

### 7. Inform User

```
Pivot complete.

- Created: [[PV-2026-01-29]] with full details
- Preserved: Old work in pivot_subtask_name/
- New task: [[1.3]] — [new approach description]

Continuing with new approach.
```

---

## Folder Structure After Pivot

```
parent_task/
├── task.md                  # Updated subtasks + pivots fields
├── 1_1/                     # Unchanged sibling
│   └── task.md
├── pivot_1_2/               # Renamed with pivot_ prefix
│   └── task.md              # status: pivoted
├── 1_3/                     # New replacement task
│   └── task.md
└── pivots/
    └── PV-2026-01-29.md     # Pivot record
```

---

## Checklist

Before completing a pivot, verify:

- [ ] User approved the pivot
- [ ] Pivot record created with evidence
- [ ] Old folder renamed with `pivot_` prefix
- [ ] Old task status set to `dropped`
- [ ] New task created with clear objective
- [ ] Parent's `subtasks` updated (old removed, new added)
- [ ] Parent's `pivots` field updated
- [ ] Parent's markdown has Pivot History section
- [ ] User informed of completion

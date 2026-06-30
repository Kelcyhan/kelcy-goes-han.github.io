# Goal Template

A goal is a **temporal view** over areal work items. It defines a desired outcome with a deadline, and orders the work that needs to happen to achieve it. Goals are not work items — they're completion boundaries.

**Where they live**: `goals/` directory under the project root, or inline in the project root YAML for simple projects. Each goal gets its own file when it has a sequence or observations.

**Relationship to areal entities**: Goals reference tasks and domains by ID. The work items live in the areal hierarchy. The goal just says "these things, in this order, by this date." Backlog and tasks connect to goals via `goals:` tags on the areal entities — the resolver consolidates them into state.yaml.

---

````markdown
---
project_id: "<project_id>"
id: "<goal-slug>"
type: goal
title: "<Desired outcome>"
target: "YYYY-MM-DDTHH:MM"    # deadline (always include time)
status: active                  # active | paused | achieved | dropped
owner: [user]                   # who is responsible for the OUTCOME (not the tasks)

done_when:
  - "<What must be true for this goal to be met>"
  - "<Another criterion>"

# Sequence — what must happen, in what order
# Each step references an areal entity with a human-readable title.
# depends_on: lists steps that must complete before this one can start.
# This IS a DAG — steps can have multiple predecessors.
sequence:
  # - id: "<task_id>"
  #   title: "<What this step accomplishes>"
  #   depends_on: []
  # - id: "<task_id>"
  #   title: "<What this step accomplishes>"
  #   depends_on: ["<predecessor_id>"]

# Milestones — named checkpoints for progress reporting
milestones:
  # - id: "<slug>"
  #   title: "<Concrete deliverable or checkpoint>"
  #   steps: ["<task_id>", "<task_id>"]

# Context (NO backlog — backlog lives on areal entities with goals: tags)
references: []                  # key documents relevant to this goal (3-5 max)
  # - "1_5/artifacts/study_protocol.md"

observations: []                # agent-written timestamped notes
  # - date: YYYY-MM-DD
  #   note: "<What the agent noticed>"

decisions: []                   # choices that constrain this goal's scope/approach
  # - date: YYYY-MM-DD
  #   decision: "<What was decided>"
  #   context: "<Why>"

updated: YYYY-MM-DD
---

## Context
<Why this goal matters. Background, constraints, stakeholders. 2-3 sentences.>

## Notes
<Free-form space for strategy, discussion points, open questions about this goal.>
````

---

## Example

```yaml
id: paper-deadline
title: "Submit HCI paper to CHI"
target: 2026-04-15T17:00
status: active
owner: [user]

done_when:
  - "Paper submitted to CHI submission system"
  - "All figures and supplementary materials included"
  - "Co-author approval received"

sequence:
  - id: "1.5.2"
    title: "Literature review — survey scheduling + agent PM systems"
    depends_on: []
  - id: "1.5.3"
    title: "Study design — protocol, recruitment, IRB"
    depends_on: ["1.5.2"]
  - id: "1.5.4"
    title: "Run user study — 12 participants, 2 conditions"
    depends_on: ["1.5.3"]
  - id: "1.5.5"
    title: "Analysis & writing — stats, figures, full draft"
    depends_on: ["1.5.4", "1.2.2"]

milestones:
  - id: lit-ready
    title: "Literature review complete"
    steps: ["1.5.2"]
  - id: study-done
    title: "User study data collected"
    steps: ["1.5.3", "1.5.4"]

observations:
  - date: 2026-03-08
    note: "Advisor wants scheduling angle emphasized"

decisions:
  - date: 2026-03-08
    decision: "Focus on scheduling, not general task management"
    context: "Advisor feedback + overlap with CSCW paper"
```

An agent reading this file immediately understands: what must be done, in what order, what the checkpoints are, and what decisions constrain the approach.

---

## Usage Notes

1. **sequence**: Each step is an areal entity (task or domain) with `depends_on` listing predecessors. This IS a DAG — steps can have multiple predecessors: `depends_on: ["1.5.2", "1.2.2"]`. Steps with `depends_on: []` can start immediately. Always include a `title` — the agent should understand the plan without looking up task files.

2. **milestones are checkpoints**, not DAG nodes. They group sequence steps for progress reporting. A milestone with `steps: ["1.5.3", "1.5.4"]` reports: "2 tasks, 1 done, 30h remaining."

3. **Owner** is who's responsible for the GOAL outcome, not individual tasks. A goal might be `owner: [user]` (user must present to advisor) while its tasks are `owner: [agent]`.

4. **No backlog on goals.** Backlog lives on areal entities (project, domain, parent task) with `goals: ["<goal-id>"]` tags. The resolver scans all areal entities and consolidates tagged backlog into state.yaml per goal. This avoids duplication — backlog has one home (areal), goals just link to it.

5. **References** are pointers to documents the agent should read when reviewing this goal — key artifacts, research, external links. Not exhaustive — 3-5 max.

6. **Observations vs decisions**: Observations are things noticed ("pilot might fail"). Decisions are choices made ("cut scope to 3 experiments"). Decisions constrain future work.

7. **Tasks and backlog connect back** via `goals: ["<goal-id>"]` on the areal entity (plural — a task/backlog item can serve multiple goals). The resolver collects these as `tagged_tasks` and `tagged_backlog` in state.yaml.

8. **Goals without sequence**: Valid. The resolver still aggregates remaining hours from tagged tasks and tagged backlog, and compares to target. No critical path computation without ordering.

## Goal Status

| Status | Meaning |
|--------|---------|
| `active` | Work in progress toward this goal |
| `paused` | Consciously on hold — deadline may slip |
| `achieved` | All done_when criteria confirmed met by user |
| `dropped` | Abandoned — goal is no longer relevant |

The resolver computes schedule status (`on-schedule`, `tight`, `behind`) separately in state.yaml. The `status` field here is a lifecycle marker, not a schedule indicator.

## Where Goals Live

For projects with ≤ 2 simple goals, embed in the project root YAML (just `id`, `title`, `target`, `done_when`). For anything more, create goal files:

```
AgentSystem/
├── task.md                # project root — goals: ["paper-deadline", "system-v1"]
├── goals/
│   ├── goal_paper_deadline.md
│   └── goal_system_v1.md
├── 1_1/
│   └── ...
```

The project root's `goals:` array becomes a list of goal IDs referencing the files.

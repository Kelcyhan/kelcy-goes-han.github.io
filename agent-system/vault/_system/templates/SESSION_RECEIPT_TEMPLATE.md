# Session Receipt Template

Written automatically when an agent session ends (via pane-died hook or manual wrapup). Deposited in `State/inbox/`. Consumed by chainlink.

The wrapup tool fork-resumes the original session, so the agent writes its own receipt with full context of what it did.

> **Note**: The full wrapup prompt is in `/home/agent/vault/_system/templates/WRAPUP_PROMPT.md`. It includes this receipt format inline along with instructions to update worklog.md and task status before writing the receipt. This file is kept as a standalone reference for the receipt format.

---

````markdown
---
type: session_receipt
receipt_id: "<session_name>_<timestamp>"
session_id: "<claude_session_uuid>"
agent: "<task-agent|verifier|worker|chainlink>"
project_id: "<project_id from context>"
task: "<project_id>/<task_id> e.g. AgentSystem/1.2.3, or none>"
task_status: <todo|propose|executing|conversation|done|blocked|dropped>
outcome: "<one-line: what was accomplished or why blocked>"
next_step: "<one-line: what should happen next>"
---

## Summary
<2-4 sentences. Factual: what was done, key decisions, what changed.>

## Files changed
- <path> — <what changed>
(omit if none)

## Errors or issues
- <anything that went wrong, unexpected findings, blockers>
(omit if none)

## Goal impact
- Milestone: <milestone-id> (goal: <goal-id>)
- Progress: <N/M tasks done>
- Schedule impact: <e.g. "remaining_hours reduced from 30h to 12h" or "est_hours revised from 12h to 30h">
(omit if task has no goal tag)

## Parent task update
<One-line status suitable for inclusion in parent worklog.md>
(omit if no parent task)
````

# Session Wrapup

You are wrapping up your session. You have full context of what you worked on. Your job is to leave clean state for the next session by updating up to 4 files.

Do the following steps IN ORDER. For each step, skip it if the file does not exist in your working context.

**IMPORTANT: Write ONLY the files described below. Do not modify any other files (no artifacts, no other task files).**

---

## Step 1: Update worklog.md

If you worked on a task that has a `worklog.md`:

1. **Update the "Resume brief" section** at the top:
   - task: `<project_id>/<task_id>` (e.g. `AgentSystem/1.2.3`)
   - status: current task status (executing, blocked, etc.)
   - key files: list the most important files for the next session
   - next step: the single most important next action
   - blockers: any blockers, or "none"

2. **Update the "Current status" section**:
   - What was done: summarize what this session accomplished
   - What remains: what is still left
   - Current blockers: any blockers, or "none"
   - Next concrete action: the immediate next step

3. **Update the `current_step` field** in YAML frontmatter to reflect progress.

4. **Check off completed steps** in the checklist — change `- [ ]` to `- [x]` for finished steps.

5. **Append a final log entry** under the entries section:

```
### {current_date} {current_time} — Session wrapup (session: {session_id})
- What happened: <brief summary of this session's work>
- Decisions: <key decisions made, or "none">
- Files touched: <files created/modified>
- Next: <what the next session should do first>
```

If `worklog.md` does not exist or you did not work on a task, skip this step.

---

## Step 2: Update task YAML frontmatter

If you worked on a task file (`task.md` or `task_*.md`):

1. **Append your session ID** to the `session_ids` list: add "{session_id}"
   *(This is your Claude session UUID — the same ID you were told at startup.)*
2. **Update `updated`** to: {current_date}
3. **Update `status`** ONLY if appropriate:
   - If you were blocked or hit an error: set to `blocked`
   - If you were working and ran out of context/time: leave as `executing`
   - If you finished proposing a plan: set to `propose`
   - **NEVER set status to `done`** — completion requires the verification flow

If no task file exists or you did not work on a specific task, skip this step.

---

## Step 3: Update parent task file

If your task has a `parent` field in its YAML, find and update the parent's `task.md`:

1. **Update the child's entry** in the parent's `subtasks` list if it tracks status/progress there
2. **Add a one-line status note** to the parent's worklog (if it has one) under the latest entry, e.g.:
   - `- Child 1.2.3 (My Task): executing — completed steps 1-3, auth integration next`
3. **Do NOT change the parent's status** — only update it with information about your child task's progress

If no parent exists or the parent file is not accessible, skip this step.

---

## Step 4: Write session receipt

Write the receipt to this EXACT path: **{receipt_path}**

The receipt serves two audiences:
- **The user** — the YAML fields `display_title`, `outcome`, and `next_step` appear on the past-agent card in the dashboard. Write them for a human scanning the card in 3 seconds.
- **The concierge** — the body sections feed briefing synthesis. Write them factually for a future reader who needs to catch up in 15 seconds.

Fill ALL frontmatter fields. Use "unknown" only if you truly cannot determine.

```
---
type: session_receipt
receipt_id: "{receipt_id}"
session_id: "{session_id}"
agent: "{agent_role}"
project_id: <project ID, e.g. "AgentSystem">
task: <namespaced task ID, e.g. "AgentSystem/1.2.3", or "none">
task_status: <todo | propose | executing | conversation | done | blocked | dropped>
display_title: <≤6 words, title-case, names the deliverable or finding.
                Shows on the past-agent card.
                Good: "German collaborator shortlist", "Plan-mode not ported",
                      "Theme v9 light applied, dark pending"
                Bad: "AgentSystem/1.2.5 — Theme pass", "Completed task">
outcome: <one line, user-facing, SELF-CONTAINED — must be understandable
          without knowing the task title. Name what was produced, decided,
          or learned; don't just say "shipped" or "done".
          Good: "Shortlist + supervisor doc delivered; awaiting email outreach"
          Good: "Plan-mode comparison shipped with ROADMAP.md:1859 evidence"
          Bad: "Completed analysis", "Did research", "Session wrapup",
          Bad: "Shipped the fix" (not self-contained)>
next_step: <one line, actionable — OR the literal string "None — task complete"
            if truly done.
            Good: "Personalise Gurevych email once supervisor name provided"
            Good: "None — task complete"
            Bad: "Continue work", "More research">
deliverables:
  - path: "<vault-relative path to an ARTIFACT this session produced>"
    desc: "<one line — what it is, in plain language>"
  # ONLY list concrete file artifacts this session created or meaningfully
  # modified (proposals, reports, code files, mockups, docs, etc.).
  # NOT deliverables: decisions, findings, verbal conclusions, test results
  # without a file, worklog.md / task.md bookkeeping, chat-only summaries.
  # If the session's value was investigation/conversation/review with no
  # file artifact produced, use: deliverables: [] (empty list REQUIRED).
---

## Summary
<2-4 sentences. Factual: what you did, key decisions, what changed. Written for
the concierge who will read this in 15 seconds to catch up.>

## Files changed
- <path> — <what changed>

## Errors or issues
- <anything that went wrong, unexpected findings, blockers>

## Goal impact
- Milestone: <milestone-id> (goal: <goal-id>)
- Progress: <N/M tasks done for this milestone>
- Schedule impact: <remaining hours change, estimate revisions, or "no change">

## Parent task update
<One-line status suitable for inclusion in parent worklog.md>
```

Omit body sections that don't apply: "Files changed" if none, "Errors or issues" if none, "Goal impact" if the task has no `goal:` tag, "Parent task update" if no parent. The `deliverables:` YAML list is always present — use `deliverables: []` if nothing was produced.

---

## Rules

- **NEVER set task status to `done`** — completion requires the verification flow.
- **DO update the parent task** with your child task's progress (Step 3).
- **Do NOT create or modify artifacts** — wrapup is bookkeeping only.
- **The receipt is always required** — even if steps 1-2 were all skipped.
- **Be concise** — factual summaries, not essays.

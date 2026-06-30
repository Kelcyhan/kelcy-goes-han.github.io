---
type: verification_report
task: "<project_id>/<task_id>"
project_id: "<project_id>"
task_id: "<task_id>"
verdict: "<PASS|PARTIAL|FAIL>"
verifier_session: "<verifier tmux session name>"
task_agent_session: "<task-agent tmux session name>"
criteria_passed: 0
criteria_failed: 0
criteria_total: 0
date: "YYYY-MM-DD HH:MM"
---

# Verification Report — <task_id>

## Task context
- **Task**: `<task file path>`
- **Plan**: `<worklog.md path>`
- **Objective**: <one-line task objective>

## Criteria assessment

### Criterion 1: <criterion text from YAML done_when>
- **Verdict**: PASS | FAIL
- **Evidence**: <specific file references, line numbers, or artifact paths that prove this>
- **Notes**: <any caveats or observations>

### Criterion 2: <criterion text>
- **Verdict**: PASS | FAIL
- **Evidence**: <evidence>
- **Notes**: <notes>

<!-- Repeat for each criterion in YAML done_when -->

## Quality checks

### Completeness
- Are all plan steps addressed? <yes/no + details>
- Are all expected artifacts present? <yes/no + details>

### Consistency
- Do artifacts match the plan's stated approach? <yes/no + details>
- Are there contradictions between files? <yes/no + details>

### Quality
- Are deliverables sufficient for the task's purpose? <yes/no + details>
- Are there obvious gaps or rough edges? <yes/no + details>

## Suggested fixes
<!-- Only if verdict is PARTIAL or FAIL. Concrete, actionable items. -->
1. <specific fix with file path and what to change>
2. <fix>

## Overall verdict

**VERDICT: <PASS|PARTIAL|FAIL>**

- Criteria passed: <N>/<total>
- Summary: <1-2 sentence assessment>

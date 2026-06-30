# Briefing Template

The current briefing is the concierge's "start here" snapshot. Written by chainlink (or concierge on cold start). Kept short. Old versions archived.

---

````markdown
---
type: briefing
created: YYYY-MM-DD HH:MM
window: "since <timestamp>"
---

# Current Briefing

## Schedule status
- <goal-id> (<target>): <ON-SCHEDULE|TIGHT|BEHIND> — buffer <N>h
  - <milestone>: <status>, <remaining>h remaining
- Alerts: <critical/high alerts from state.yaml, or "none">

## What changed since last time
- ...

## Open loops (needs decisions)
- ...

## Suggested next focus (with reasons)
- ...

## Quick links
- Projects:
  - `<project_id>/1` — <project title>
- State:
  - `State/projects/<P>/state.yaml`
  - `State/logs/YYYY-MM-DD/synthesis.md`
````

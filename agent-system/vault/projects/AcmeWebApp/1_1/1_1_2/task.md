---
project_id: "AcmeWebApp"
id: "1.1.2"
type: task
title: "Migrate Button + Input + Form primitives to tokens"
desc: "Replace hardcoded colors/spacing with token references; ensure variants still match designer specs"
status: executing
autonomy: approval
parent: "1.1"
owner: [user, agent]

goals: ["v2-launch/design-system-ready"]

est_hours: 8

started: "2026-06-02"
completed: ""
last_activity: "2026-06-04"
actual_duration: ""

session_ids: ["b2f314c0-da03-41ee-867d-10f05c7a8b69"]
order: 20
artifacts:
  - path: "1_1/1_1_2/artifacts/before_after.png"
    desc: "Side-by-side screenshot of primitives before/after migration"
  - path: "1_1/1_1_2/artifacts/diff_summary.md"
    desc: "Diff summary across components"
verification:
  - text: "All Button variants match Figma spec at 100% zoom"
    done: true
  - text: "Form validation states use semantic tokens (success/warn/danger)"
    done: false
  - text: "No regressions in existing screenshot tests"
    done: false
outcome: ""
updated: 2026-06-04
---

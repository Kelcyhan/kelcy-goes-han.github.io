---
project_id: "AcmeWebApp"
type: task
title: "Spike: try view-transitions for route changes"
desc: "60-min experiment — see if CSS view-transitions API works inside TanStack Router"
status: done
autonomy: auto
owner: [agent]

started: "2026-05-31"
completed: "2026-05-31"
last_activity: "2026-05-31"
actual_duration: "45m"

artifacts:
  - path: "Scratch/quick-experiment/artifacts/demo.html"
    desc: "Minimal demo page"
  - path: "Scratch/quick-experiment/artifacts/notes.md"
    desc: "Findings + recommendation"
verification:
  - text: "Demo loads in Chrome and animates"
    done: true
outcome: |
  Works in Chrome 117+, Safari 18+. Falls back gracefully via @supports.
  Recommend adopting for the v2 settings flow first as a controlled trial.
updated: 2026-05-31
---

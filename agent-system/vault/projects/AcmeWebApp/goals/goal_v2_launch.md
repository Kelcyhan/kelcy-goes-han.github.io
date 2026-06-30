---
type: goal
id: "v2-launch"
project_id: "AcmeWebApp"
title: "Customer-facing v2 dashboard launched"
target: "2026-08-15T17:00"
status: in_progress
done_when:
  - "All seven core flows demoed at >95% success rate"
  - "Launch blog post + comms shipped"
  - "Legacy app redirects active"

sequence:
  - milestone: "design-system-ready"
    title: "Design system tokens + components shipped"
    target: "2026-06-30"
    done_when:
      - "Storybook published with all primitives"
      - "Tokens consumed in app shell"
  - milestone: "api-ready"
    title: "v2 API gateway live"
    target: "2026-07-15"
    done_when:
      - "All v2 endpoints behind /api/v2"
      - "Rate limits + auth wired"
  - milestone: "soft-launch"
    title: "10% rollout to friendly customers"
    target: "2026-08-01"

observations:
  - date: "2026-05-23"
    note: "Design tokens spec landed (1201 lines). Conflict between procedural vs AIVD 3D direction blocks Figma Make ingest."
  - date: "2026-06-04"
    note: "Auth migration spike showed OAuth would push launch by ~3 weeks. Decision needed."

updated: 2026-06-04
---

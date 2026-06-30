---
project_id: "AcmeWebApp"
id: "1"
type: project
title: "Acme Web App"
desc: "Build the v2 customer dashboard with new design system"
status: active
owner: [user, agent]

vision: "Ship a customer dashboard that loads under 1s and supports 10k concurrent sessions by Q3."
horizon: "Q2-Q3 2026"

goals:
  - "v2-launch"
  - "perf-budget"

open_questions:
  - "Should auth migrate to OAuth before or after v2 launch?"
  - "Confirm telemetry vendor — Datadog vs Honeycomb"

started: "2026-04-12"
completed: ""
last_activity: "2026-06-04"
actual_duration: ""

subtasks: ["1.1", "1.2"]
backlog:
  - title: "Wire up feature flags via GrowthBook"
    desc: "Need server-side flag eval for the new pricing widget and progressive rollout for the v2 dashboard. Ties into the launch goal."
    goals: ["v2-launch"]
    est_hours: 8
    acceptance_sketch:
      - "Flags readable in SSR + CSR"
      - "Targeting rules editable from admin UI"
    added: 2026-05-29
  - title: "Add session replay sampling"
    desc: "10% sampling, exclude billing flows. PII redaction on form fields."
    goals: ["v2-launch"]
    est_hours: 4
    added: 2026-06-01
  - title: "Migrate legacy email templates to MJML"
    desc: "Current Mustache templates are unmaintained. MJML gives us responsive defaults."
    est_hours: 12
    added: 2026-05-22

session_ids: ["b2f314c0-da03-41ee-867d-10f05c7a8b69", "a17ce4f1-2b9e-44d3-bd72-0e3e91b88aa1"]
outcome: ""
updated: 2026-06-04
---

# Acme Web App — v2 Customer Dashboard

The v2 dashboard replaces the legacy AngularJS app with a React + Vite stack. We are rebuilding the
information architecture around customer "workspaces" rather than per-account dashboards.

## Why now

- Legacy app is unmaintained (last commit 2024-08)
- Telemetry shows 38% of sessions abandon during navigation
- Sales asked for white-label support — current code can't support it

## Out of scope

- Mobile app rewrite (separate effort under MobileLaunch project)
- Billing UI (handled by external Stripe portal)

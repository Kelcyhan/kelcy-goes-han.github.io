---
project_id: "AcmeWebApp"
id: "1.1"
type: domain
title: "Frontend — App Shell + Components"
desc: "Everything the customer sees in the v2 dashboard"
status: active
parent: "1"
owner: [user, agent]

context:
  purpose: "Build the v2 dashboard UI: shell, navigation, primitives, and feature surfaces."
  background:
    - "React 19 + Vite 5 + TypeScript strict mode"
    - "Tailwind 4 with custom design tokens (see artifacts/design_tokens.json)"
    - "State: Zustand for app shell, React Query for server cache"
    - "Routing: TanStack Router (file-based)"
  decisions:
    - "Chose Zustand over Redux Toolkit — smaller surface for our scale"
    - "Adopted shadcn/ui as base; rebrand via tokens only"
    - "Dropped CSS Modules in favor of Tailwind utility-first"
  references:
    - "1_1/artifacts/design_tokens.json"
    - "1_1/artifacts/component_inventory.md"

open_questions:
  - "Should we adopt Radix Themes wholesale or stay with shadcn primitives?"

backlog:
  - title: "Build empty-state illustration set"
    desc: "12 empty states across the app. SVG, themeable via currentColor."
    goals: ["v2-launch/design-system-ready"]
    est_hours: 16
    added: 2026-05-30
  - title: "Add keyboard shortcut palette"
    desc: "Cmd+K palette with fuzzy search across nav + actions. Reuse cmdk."
    est_hours: 6
    added: 2026-06-02
  - title: "Refactor settings page into nested routes"
    desc: "Currently a giant tabs component. Move to nested routes for deep-linking."
    est_hours: 10
    added: 2026-06-03

focus: "Ship the design token migration before the 06-30 milestone"
priorities:
  - "Build empty-state illustration set"
  - "Add keyboard shortcut palette"
horizon: "Through end of Q3 2026"

started: "2026-04-15"
last_activity: "2026-06-04"

progress: "2/3"
health: active

subtasks: ["1.1.1", "1.1.2", "1.1.3"]
session_ids: ["a17ce4f1-2b9e-44d3-bd72-0e3e91b88aa1"]
summary: ""
updated: 2026-06-04
---

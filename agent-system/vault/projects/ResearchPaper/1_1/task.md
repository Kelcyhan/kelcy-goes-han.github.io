---
project_id: "ResearchPaper"
id: "1.1"
type: domain
title: "Literature Review"
desc: "Systematic literature review covering reflective practice, AI companions, mental health UX"
status: active
parent: "1"
owner: [user, agent]

context:
  purpose: "Map the design space and produce a Related Work section."
  background:
    - "PRISMA-Lite protocol (modified for HCI venues)"
    - "Inclusion: HCI venues 2020-26, peer-reviewed, > 6 participants"
    - "Tool: papers ingested into research KB via vault indexer"
  decisions:
    - "Excluded therapy bot evaluations focused purely on clinical outcomes"
    - "Three primary themes: reflection, parasocial bonding, agency"
  references:
    - "1_1/artifacts/inclusion_criteria.md"
    - "1_1/artifacts/sources_inventory.json"

backlog:
  - title: "Code 13 ingested papers using thematic coding"
    desc: "Two-coder process. Reconcile in shared Google Doc, then export to artifacts."
    goals: ["chi-submission/lit-review-done"]
    est_hours: 14
    added: 2026-05-26

focus: "Finish coding the first 13 papers before pilot study"
priorities:
  - "Code 13 ingested papers using thematic coding"
horizon: "Through 2026-07-01"

started: "2026-05-12"
last_activity: "2026-06-04"

progress: "1/2"
health: active

subtasks: ["1.1.1", "1.1.2"]
session_ids: []
summary: ""
updated: 2026-06-04
---

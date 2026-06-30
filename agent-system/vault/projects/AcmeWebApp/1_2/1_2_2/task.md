---
project_id: "AcmeWebApp"
id: "1.2.2"
type: task
title: "Session auth — secure cookies + CSRF rotation"
desc: "Harden the existing cookie session flow ahead of public v2 rollout"
status: done
autonomy: approval
parent: "1.2"
owner: [user, agent]

goals: ["v2-launch/api-ready"]

est_hours: 6

started: "2026-05-10"
completed: "2026-05-17"
last_activity: "2026-05-17"
actual_duration: "5h"

session_ids: []
order: 20
artifacts:
  - path: "1_2/1_2_2/artifacts/auth_review.md"
    desc: "Threat model + mitigation table"
verification:
  - text: "CSRF token rotates on login + every 24h"
    done: true
  - text: "Cookies set Secure + HttpOnly + SameSite=Lax"
    done: true
outcome: |
  Hardened cookie attributes. Added rotation worker. Threat model documented.
  Punted refresh-token rotation to the OAuth migration (separate effort).
updated: 2026-05-17
---

---
project_id: "AcmeWebApp"
id: "1.2.1"
type: task
title: "Lock down OpenAPI v2 contracts"
desc: "Finalize the OpenAPI spec for v2 endpoints — generate client types + server routes"
status: executing
autonomy: auto
parent: "1.2"
owner: [agent]

goals: ["v2-launch/api-ready"]

est_hours: 12

started: "2026-05-28"
completed: ""
last_activity: "2026-06-03"
actual_duration: ""

session_ids: []
order: 10
artifacts:
  - path: "1_2/1_2_1/artifacts/openapi.json"
    desc: "Source OpenAPI 3.1 spec"
  - path: "1_2/1_2_1/artifacts/contract_changelog.md"
    desc: "Breaking change log"
verification:
  - text: "Spec passes spectral lint with zero errors"
    done: true
  - text: "Client types generate without diff for 7 days"
    done: false
outcome: ""
updated: 2026-06-03
---

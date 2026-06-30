---
project_id: "AcmeWebApp"
id: "1.2"
type: domain
title: "Backend — API Gateway + Auth"
desc: "v2 API surface, auth, rate limiting, request tracing"
status: active
parent: "1"
owner: [user, agent]

context:
  purpose: "Stand up the /api/v2 gateway with consistent contracts, auth, and observability."
  background:
    - "Node 22, Fastify 5, Zod for schemas"
    - "PostgreSQL 16 + Prisma 6"
    - "Auth: currently session cookies; OAuth migration tabled"
  decisions:
    - "Adopted Fastify over Express — better TS + perf"
    - "Routes generated from OpenAPI spec"
  references:
    - "1_2/artifacts/openapi.json"
    - "1_2/artifacts/auth_review.md"

open_questions:
  - "Switch session store to Redis or stay with Postgres?"

backlog:
  - title: "Add request tracing via OpenTelemetry"
    desc: "Trace inbound HTTP → DB queries → outbound webhooks. Export to Honeycomb."
    goals: ["v2-launch/api-ready"]
    est_hours: 10
    added: 2026-06-01
  - title: "Implement per-tenant rate limits"
    desc: "Sliding window via Redis. Defaults plus per-plan overrides."
    est_hours: 8
    added: 2026-05-29

focus: "OpenAPI lockdown + auth shape for v2"
priorities:
  - "Add request tracing via OpenTelemetry"
horizon: "Through 2026-07-15 milestone"

started: "2026-05-01"
last_activity: "2026-06-03"

progress: "1/2"
health: active

subtasks: ["1.2.1", "1.2.2"]
session_ids: []
summary: ""
updated: 2026-06-03
---

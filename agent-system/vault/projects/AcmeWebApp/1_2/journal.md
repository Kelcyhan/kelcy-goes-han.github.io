---
type: journal
domain: "AcmeWebApp/1.2"
updated: 2026-06-03
---

# Backend Domain Journal

## 2026-06-03

OAuth migration spike landed. ~3 weeks of work, mostly around rotating refresh
tokens for native apps. Decision parked until after v2 launch — current cookie
auth is fine for browser-only customers.

## 2026-05-30

OpenAPI spec is the bottleneck. Frontend wants types for endpoints we haven't
finalized yet. Started shipping a "v2-alpha" namespace that's allowed to break
until the milestone — frontend wraps via React Query and treats the alpha as
unstable.

## Ideas

- [ ] Move webhook delivery to a queue with retry/DLQ semantics
- [ ] Generate Prisma migrations from OpenAPI schema diff (probably too clever)

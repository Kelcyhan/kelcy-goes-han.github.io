---
type: goal
id: "perf-budget"
project_id: "AcmeWebApp"
title: "Hit performance budget on critical paths"
target: "2026-08-15"
status: in_progress
done_when:
  - "TTI < 1.5s on cable 4G profile"
  - "Bundle < 180kb gzipped"
  - "LCP p75 < 1.2s in field data"

sequence:
  - milestone: "baseline-measured"
    title: "Establish baseline + budgets in CI"
    target: "2026-06-10"
  - milestone: "image-pipeline"
    title: "AVIF + responsive srcset across all marketing surfaces"
    target: "2026-07-01"

observations:
  - date: "2026-05-28"
    note: "Initial bundle measured at 312kb gzipped — over budget. Vendored emoji library is 64kb of the overage."

updated: 2026-05-28
---

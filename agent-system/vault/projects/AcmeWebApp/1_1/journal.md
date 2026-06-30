---
type: journal
domain: "AcmeWebApp/1.1"
updated: 2026-06-04
---

# Frontend Domain Journal

## 2026-06-04

Spent the morning measuring bundle composition. Top offenders:

- `lodash` (full import) — 24kb gz. Migrate to lodash-es with per-function imports.
- `emoji-mart` — 64kb gz. Replace with native unicode or `@emoji-mart/data` lazy-loaded.
- `recharts` — 38kb gz. Used in only one route. Lazy load the route.

Filed these as backlog items. The lodash one is mechanical and worth doing this week.

## 2026-05-30

Reviewed the design tokens spec from UIUX-Senior-Designer. Mostly clean, but two issues:

1. The motion tokens reference `cubic-bezier(0.4, 0.0, 0.2, 1)` everywhere — we should
   surface this as `--ease-standard` rather than re-pasting the literal.
2. Spacing scale jumps from 16 → 24 → 32. We have several "20px" usages in the legacy
   app — need to decide: round down (16) or up (24)? Default to round-up unless
   the change would clip content.

## Ideas (icebox)

- [ ] Consider a "performance budget" CI check that fails PRs over budget
- [ ] Story-style onboarding tour using a state machine (Pico XState?)
- [ ] Dark mode could lean on `color-mix()` rather than duplicate token sets
- [ ] Investigate `view-transitions` API for route changes

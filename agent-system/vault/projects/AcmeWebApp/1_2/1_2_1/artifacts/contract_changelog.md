# API v2 Contract Changelog

## 2026-06-03

- Added `Workspace.members[].role` enum
- Removed alpha-only `Workspace.legacyTier` (was always null)

## 2026-05-29

- Initial v2-alpha spec landed
- Resource: `/workspaces`, `/workspaces/{id}`
- Pagination via opaque `nextCursor`

## Notes

Anything in `2.0.0-alpha.*` may change without deprecation. Stable at `2.0.0`.

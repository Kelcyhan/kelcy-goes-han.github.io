# Auth Hardening Review

## Threats considered

| # | Threat | Mitigation | Status |
|---|--------|-----------|--------|
| 1 | Session theft via XSS | `HttpOnly` cookie | shipped |
| 2 | Cross-site request forgery | Double-submit token + `SameSite=Lax` | shipped |
| 3 | Session fixation | Rotate session ID on login | shipped |
| 4 | Token replay after logout | Server-side blocklist (24h TTL) | shipped |
| 5 | Long-lived sessions | 14-day absolute, 24h sliding | shipped |
| 6 | Compromised refresh token | Refresh-token rotation | **deferred to OAuth migration** |

## What changed

- `Set-Cookie` now sets `Secure`, `HttpOnly`, `SameSite=Lax` unconditionally
- CSRF tokens rotate on login + every 24h via worker
- Logout invalidates the session ID server-side (Postgres blocklist)
- Added a CI test that fails the build if cookies lack `Secure` in prod config

## Out of scope

- OAuth/OIDC migration — separate effort, parked until after v2 launch
- Step-up auth (MFA on sensitive actions) — Q4 if compliance asks

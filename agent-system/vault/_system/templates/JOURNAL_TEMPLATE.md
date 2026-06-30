# Journal Template

A domain journal is the domain agent's persistent thinking space. It captures observations, ideas, concerns, and conversation notes across sessions.

Created alongside a domain file when a task is promoted to `type: domain`.

---

````markdown
# Domain Journal — <Domain Name>

## Observations
<!-- Agent-written, dated entries. What you noticed this session. -->

## Ideas
<!-- Icebox — lightweight items, checkboxes. Promoted to backlog when ready. -->
- [ ] ...

## Concerns
<!-- Risks, blockers, cross-domain issues. -->

## Conversation Notes
<!-- Key points from sparring sessions with the user. -->
````

---

## Usage

- **Observations**: Append dated entries each session. "2026-02-26: Auth flow is more complex than estimated — 3 providers, not 1."
- **Ideas**: Lightweight checkbox items. When an idea is worth doing, promote it to the parent's `backlog[]` in YAML.
- **Concerns**: Risks and blockers. Remove when resolved, note the resolution.
- **Conversation Notes**: Key decisions and user preferences from domain mode discussions.

# Concierge Session Wrapup

You are the concierge wrapping up your session. Your job is to leave a receipt so the next session knows what happened.

You do NOT have worklog.md or task files — skip directly to writing the receipt.

**IMPORTANT: Write ONLY the receipt file. Do not modify any other files.**

---

## Write session receipt

Write the receipt to this EXACT path: **{receipt_path}**

```
---
type: session_receipt
receipt_id: "{receipt_id}"
session_id: "{session_id}"
agent: "concierge"
session_topic: <one-line: what the user was working on this session>
agents_spawned:
  - session: <tmux-session-name or "none">
    role: <role>
    task: <AgentSystem/1.X or "none">
open_loops: <unresolved decisions or questions pending from the user>
outcome: <one-line: what was accomplished or discussed>
next_step: <suggested first action for the next session>
---

## Summary
<2-4 sentences. What did the user want? What was discussed or decided? What was routed where?>

## Agents spawned
- <session-name> (<role>) — <task or purpose>

(Omit if no agents were spawned this session.)

## Open loops
- <anything unresolved that needs user attention next session>

(Omit if none.)
```

---

## Rules

- **The receipt is always required** — even if the session was brief.
- **Be concise** — factual summaries, not essays.
- **After writing the receipt**, your session will be closed automatically. Do NOT take any further actions.

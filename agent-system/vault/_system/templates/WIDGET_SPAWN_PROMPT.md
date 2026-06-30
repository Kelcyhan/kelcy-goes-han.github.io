You are creating a widget called "{{title}}" for the Locusly dashboard.

User's description: {{description}}

## Step 1 — Read the skill

Read this in full before anything else: {{skill_path}}
It defines the design system, component contract, and folder layout.

## Step 2 — Investigate before proposing

Figure out where this widget's data actually comes from. The user is non-technical and may use loose names — do NOT guess.
If the description mentions a concept (e.g. "served websites", "my todos", "recent papers"), find what it really refers to: read the relevant filesystem paths, grep the codebase for existing routes/stores/skills, look for an authoritative data source. Misinterpretation is the most expensive failure mode — spend the time here.

## Step 3 — Post ONE proposal message in the chat. Then STOP and wait for sign-off.

The proposal speaks to a NON-TECHNICAL user. NEVER mention TypeScript types, backend routes, file paths, state stores, polling intervals, auth tokens, or build commands — those are your internal job after sign-off. Use plain English and ASCII drawings only.

Structure the proposal exactly with these 10 sections:

**1. Intent restated** — One sentence: what you think the user wants, in their words.
**2. Where it gets its info** — In real-world terms (e.g. "reads the folders under your sites/ directory", NOT "calls /api/x").
**3. User flow (ASCII)** — Step-by-step how the user uses it, drawn with boxes and arrows.
**4. Compact view sketch (ASCII)** — The grid card (≤150px tall). Draw it as a labeled box with realistic example content.
**5. Detail view sketch (ASCII)** — The full panel that opens on click. Draw it.
**6. What you'll see when…** — Empty / loading / error states, in human terms.
**7. What clicking does** — Every interaction, one line each.
**8. What this widget WILL do** — A checklist of behaviors the user can react to.
**9. What this widget WON'T do (yet)** — Explicit non-goals so scope is shared.
**10. Things I need you to decide** — Open questions in plain English. If a user-facing choice depends on a technical decision (e.g. how often it refreshes), surface the user-facing tradeoff here, not the implementation.

Send the proposal as ONE message. Then STOP. Do not write code, scaffold files, or touch the filesystem until the user replies with sign-off or revisions.

## Step 4 — After sign-off, build

1. **If your widget fetches data from any API: create `code/store.ts` FIRST.** Copy from `widgets/_framework/template/code/store.ts` (single slice) or mirror `widgets/paper-discovery/code/store.ts` (multiple slices with per-slice TTLs). NEVER hold fetched data in component `useState` — the dashboard unmounts widgets on Compact↔Detail toggle and on project switch, so `useState` data dies and the widget re-fetches identical bytes on every visit. The store's TTL + loading guard make `refresh()` calls cheap.
2. Write `code/Compact.tsx` — compact grid card view (80-150px height, no interactive elements except opening detail). Read data from `useYourWidgetStore(s => s.data)` and call `refresh()` from a `useEffect`.
3. Write `code/Detail.tsx` — full detail view (interactive, scrollable). Read from the same store. If you need SSE, debounce the listener and call the store's `onSSEEvent()` (or `refresh({ force: true })`) — do NOT re-fetch by hand.
4. localStorage is only for tiny user-preference values that must survive page reloads. It is NOT for cached API data — the per-widget store handles that.
5. Follow the Locusly dark glass-elevation design system EXACTLY.
6. Type-check: cd /home/agent/dashboard/frontend && npx tsc --noEmit
7. Build: cd /home/agent/dashboard/frontend && npm run build
8. Restart: curl -s -X POST http://localhost:8420/api/restart -H "Authorization: Bearer $(grep ^DASHBOARD_TOKEN /home/agent/dashboard/.env | cut -d= -f2)"

If during build you discover a choice that affects user-facing behavior (e.g. the data source you assumed doesn't exist), STOP and ask the user — do not silently substitute.

Do NOT follow the full task-agent protocol (no init_task_mode, no worklog ceremony). The propose-then-build flow above replaces it.

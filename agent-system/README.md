# Agent System — Design System Export

This archive is a representative sample of the Agent System web app, packaged for a
design-system + components + typography redesign. It is **not** a full working
checkout — there's no `node_modules/`, no `dist/`, no real user data. The
intent is to cover every visual surface and every data shape the UI renders.

## Layout

```
frontend/         # React + Vite app source. Drop-in replaceable for the live one.
  src/
    components/   # 20 component groups — see "Component map" below
    styles/       # tokens.css, base.css, overrides.css, animations.css
    stores/       # Zustand stores (mocked data acceptable for design work)
    hooks/        # shared hooks
    STYLE_GUIDE.md
  index.html
  package.json
  vite.config.ts
  tsconfig*.json
  components.json # shadcn registry config
  e2e/            # Playwright spec files (no test-results bundled)

vault/            # Sample data the dashboard reads from. Shape-accurate.
  CLAUDE.md       # Entry-point doc
  _system/        # Agent protocols, skills, templates (read-only conventions)
  State/          # briefing, inbox receipts, user_queue.json, daily synthesis, project state
  projects/       # 5 sample projects of varied shape (see "Sample projects" below)
  Scratch/        # vault-level scratch task
```

## Component map (`frontend/src/components/`)

| Folder | What it renders |
|--------|------------------|
| `home/` | Home screen — project cards, fleet bar, recent activity |
| `pm/` | Project management — boards, lanes, task cards, goals, domains |
| `concierge/` | Concierge chat panel — greeting + routing UI |
| `chat/` | Chat surface — messages, attachments, tool calls |
| `floating-chat/` | Floating chat affordance |
| `workspace/` | Per-task workspace — worklog, artifacts, sessions |
| `inbox/` | Session receipts inbox + queue items |
| `widgets/` | Compact widget primitives (snap goals, status, etc.) |
| `terminal/` | Embedded terminal UI |
| `voice/` | Voice input affordance |
| `docs/` | Doc + artifact viewers (md / html / pdf / image / json …) |
| `helper/` | Tooltips, contextual helpers |
| `settings/` | Settings surfaces |
| `auth/` | Sign-in flows |
| `layout/` | App shell, sidebar, headers |
| `primitives/` | App-specific primitives layered above `ui/` |
| `ui/` | shadcn-flavored base primitives (button, input, dialog, etc.) |
| `kibo-ui/` | Auxiliary primitives |
| `shared/` | Cross-feature shared components |
| `ai-elements/` | AI-specific element components |

## Sample projects (`vault/projects/`)

Five projects chosen to cover every card state the UI must render:

| Project | Type | Status | Goals | Domains | Notes |
|---------|------|--------|-------|---------|-------|
| **AcmeWebApp** | project | active | 2 (multi sub-goal) | 2 | Largest. Frontend domain + Backend domain, tasks in todo / propose / executing / blocked / done. Has Scratch experiment. |
| **ResearchPaper** | project | active | 1 (3 milestones) | 1 | Academic. LaTeX (`.tex` + `.bib`), PDF draft, JSON sources inventory, CSV coding progress. |
| **MobileLaunch** | project | paused | 0 | 0 | Paused project. Shelved + dropped task states. |
| **MarketingSite** | project | complete | 0 | 0 | Completed project. Outcome filled, all tasks done. Includes `.docx` (brand voice) + CSV (redirects). |
| **QuickPrototype** | task (root) | todo | 0 | 0 | Smallest. Only Scratch work. Shows the un-promoted shape. |

Plus `Scratch/loose-investigation/` at the vault root — a vault-level ad-hoc task.

## Artifact formats covered

Every renderer in the docs viewer has at least one example to load:

| Format | Location |
|--------|----------|
| `.md` | many — e.g. `AcmeWebApp/1_1/artifacts/component_inventory.md` |
| `.html` | `AcmeWebApp/1_1/1_1_1/artifacts/preview.html`, `…/Scratch/quick-experiment/artifacts/demo.html`, `QuickPrototype/Scratch/sketch-1/artifacts/mockup.html` |
| `.css` | `AcmeWebApp/1_1/1_1_1/artifacts/tokens.css` |
| `.json` | `AcmeWebApp/1_1/1_1_1/artifacts/design_tokens.json`, `…/1_2/1_2_1/artifacts/openapi.json`, `ResearchPaper/1_1/1_1_1/artifacts/sources_inventory.json` |
| `.tex` (Overleaf) | `ResearchPaper/1_3/artifacts/main.tex` |
| `.bib` | `ResearchPaper/1_3/artifacts/references.bib` |
| `.pdf` | `ResearchPaper/1_3/artifacts/draft_v0.pdf` |
| `.docx` | `MarketingSite/1_1/artifacts/brand_voice_guidelines.docx` |
| `.png` | `AcmeWebApp/1_1/1_1_2/artifacts/before_after.png`, `…/1_1_3/artifacts/wireframe.png`, `…/Scratch/quick-experiment/artifacts/demo_screenshot.png`, `ResearchPaper/1_3/artifacts/figure_1_overview.png` |
| `.csv` | `MarketingSite/1_2/artifacts/redirects.csv`, `ResearchPaper/1_1/1_1_2/artifacts/coding_progress.csv` |
| `.txt` | `Scratch/loose-investigation/artifacts/spawn_log_samples.txt` |
| `.yaml` | `State/projects/*/state.yaml` |

## Sample State data

- `State/briefings/current.md` — recent briefing
- `State/inbox/receipt_*.md` — 2 unprocessed receipts
- `State/inbox/archive/` — empty (folder placeholder)
- `State/user_queue.json` — 2 pending + 1 resolved user-queue item
- `State/logs/2026-06-05/synthesis.md` — example daily synthesis
- `State/projects/<P>/state.yaml` — resolver output per project

## Running the frontend

After unzipping:

```bash
cd frontend
npm install      # or pnpm / bun
npm run dev      # Vite dev server
```

The app expects a backend at the gateway URL configured in `vite.config.ts`.
For pure design work you can mock fetch calls in your dev environment, or point
the gateway URL at a stub.

## Portfolio live demo build

The portfolio embeds `frontend/dist/` from `AgentSystem/index.html`, so the Vite
build uses a relative base path (`base: './'`) and should be generated with mock
mode enabled:

```bash
cd frontend
VITE_USE_MOCKS=1 npm run build
```

This keeps the demo self-contained under the portfolio subdirectory and avoids
requiring a private backend for visitors.

## What is intentionally not included

- `node_modules/` (~640 MB) — run `npm install`
- `dist*/` (build artifacts)
- `public/svgedit/` (~19 MB third-party SVG editor)
- Real user vault contents (`projects/`, `sites/` from the live system)
- Backend code (`server/`, `spawner/`) — out of scope for a design pass
- `e2e/test-results/` (~21 MB Playwright traces)

## Conventions to know

- Task folders are **nested inside parent folders**. `1.1.1` lives at `1_1/1_1_1/`, not flat.
- Entity types are set in YAML frontmatter `type:` — `task` | `domain` | `project`.
- Status enums per type are listed in `_system/AGENT_CORE.md`.
- Every task folder has `task.md`; non-trivial ones add `worklog.md` and `artifacts/`.
- Read `_system/AGENT_CORE.md` first if any of the data shapes look unfamiliar.

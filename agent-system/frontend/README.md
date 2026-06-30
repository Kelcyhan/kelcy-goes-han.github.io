# Agent Dashboard — Frontend

React + TypeScript + Vite + Tailwind CSS rewrite of the Agent Dashboard UI.

## Quick Start

```bash
# 1. Start the backend (terminal 1)
cd /Users/philipp/coden/agent_system_design/dashboard
python run.py
# → FastAPI on http://localhost:8420

# 2. Start the frontend dev server (terminal 2)
cd /Users/philipp/coden/agent_system_design/dashboard/frontend
npm run dev
# → Vite on http://localhost:5173 (proxies /api → :8420)
```

Open `http://localhost:5173/` (add `?token=...` if `DASHBOARD_TOKEN` is set in `.env`).

## Production Build

```bash
npm run build    # → frontend/dist/
```

When `frontend/dist/` exists, FastAPI serves it automatically — no separate dev server needed:
```bash
cd /Users/philipp/coden/agent_system_design/dashboard
python run.py
# → serves React app + API on http://localhost:8420
```

## Mobile / Remote Access

Via Tailscale:
```bash
# With HTTPS (required for voice/mic):
uvicorn server.app:app --host 0.0.0.0 --port 8420 \
  --ssl-certfile ~/philipps-macbook-pro-2.tail50fb80.ts.net.crt \
  --ssl-keyfile ~/philipps-macbook-pro-2.tail50fb80.ts.net.key
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Build | Vite 7 |
| Framework | React 19 + TypeScript |
| State | Zustand (per-domain stores) |
| Styling | Tailwind CSS v4 |
| Markdown | react-markdown + remark-wiki-link + remark-gfm |
| Terminal | @xterm/xterm + WebGL addon |
| WebSocket | Native WebSocket (custom hooks) |

## Structure

```
src/
  components/
    layout/     # Header, Sidebar, SessionList
    chat/       # ChatContainer, TurnGroup, InputBar, StatusBar
    terminal/   # TerminalPanel
    docs/       # DocsViewer, DocsBreadcrumb, DocsBadges, FileTree
    shared/     # Modal, ToastContainer
  hooks/        # useStreamWs, useTerminal, useVoice, useAuth
  stores/       # session-store, chat-store, docs-store (Zustand)
  lib/          # types, api client, markdown helpers
```

## Environment Variables

Set in `../.env`:
- `VAULT_ROOT` — path to vault root
- `DASHBOARD_TOKEN` — bearer token for auth (optional)
- `DASHBOARD_ORIGINS` — CORS origins (optional)
- `DEEPGRAM_API_KEY` — for voice transcription (optional)

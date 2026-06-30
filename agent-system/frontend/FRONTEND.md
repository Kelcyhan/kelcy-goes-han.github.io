# Frontend Architecture Guide

> **Codebase:** `dashboard/frontend/`
> **Last updated:** 2026-03-10 (after CSS restructure task 1.2.4.4)

## Layer Architecture

```
Layer 1: shadcn primitives     src/components/ui/
         Button, Dialog, Badge, Card, Popover, Select, etc.
         Standard shadcn components — never modify directly.

Layer 2: Project primitives    src/components/primitives/
         StatusBadge, ActionButton, IconButton, StatusDot,
         ProgressBar, CollapsibleCard, FileChip, GlassPanel, PMBadge
         Compose Layer 1 + design tokens. CVA variants.

Layer 3: Feature components    src/components/{chat,pm,docs,workspace,...}/
         All UI features. Use Layer 1 + 2 + Tailwind utilities.
         No CSS files — all styling is inline Tailwind.

Layer 4: CSS overrides         src/styles/
         tokens.css, base.css, animations.css, overrides.css
         Only things that genuinely need CSS (see below).
```

## Style Files (`src/styles/`)

| File | Purpose | When to edit |
|------|---------|--------------|
| `tokens.css` | Tailwind directives, `@theme` (colors, spacing, radius), `:root` CSS variables (dark/light), shadcn bridge | Adding new design tokens or colors |
| `base.css` | Body reset, scrollbar styling, glass utilities, font settings | Rarely — global resets only |
| `animations.css` | `@keyframes` + `.animate-*` utility classes | Adding new animations |
| `overrides.css` | Layout shells, 3rd-party theming (dockview, xterm, gantt), file tree nesting, ReactMarkdown content styling, mobile responsive | Theming 3rd-party components, changing app layout shell |

## Design Guidelines

The product-level design guideline lives at `docs/agent-system-design-guidelines.md`.
Use it as the shared reference for color, typography, status, buttons, cards, panels, workspace layout, and agent-specific UI patterns.

## Key Rules

1. **No new CSS classes.** If it can be a Tailwind class or component prop, it must NOT be in a CSS file.

2. **Never modify `ui/` files.** These are standard shadcn components. Customization goes in `primitives/` or via design tokens in `tokens.css`.

3. **Use design tokens for colors/shadows.** Always `text-muted-foreground`, `bg-card`, `shadow-[var(--shadow-float)]` — never raw hex values in components.

4. **Use `cn()` for conditional classes.** Import from `@/lib/utils`. Merge base + conditional classes cleanly.

5. **CSS is only for:** 3rd-party component theming (dockview, xterm, gantt), nested CSS selectors (file tree depth), ReactMarkdown HTML output styling (`doc-body`), layout shells (sidebar/workspace with glass effects), responsive `@media` overrides, `@keyframes`.

## Component Directory Map

```
src/components/
  ui/              15 shadcn components (Layer 1)
  primitives/      9 project primitives (Layer 2) + barrel index.ts
  chat/            ChatContainer, InputBar, TurnGroup, SpeakButton, StatusBar
  pm/              PMDashboard, Overview, CardGridView, NodeHeader, etc. (16 files)
  workspace/       AgentView, DocView, DockviewWorkspace, TabBar, MarkdownEditor
  layout/          Sidebar, SessionList, ProjectList, SidebarQueue
  docs/            DocsViewer, FileTree, DocsBadges, DocsBreadcrumb
  shared/          Modal, ToastContainer
  voice/           VoiceBar
  terminal/        TerminalPanel
  ai-elements/     Streamdown message renderer
  kibo-ui/         Gantt chart wrapper
```

## Primitives Reference

| Primitive | Wraps | Key Variants | Used By |
|-----------|-------|-------------|---------|
| `StatusBadge` | Badge | status colors (working, idle, waiting, error, etc.) | AgentView, Overview, SessionList |
| `ActionButton` | Button | approve, done, spawn, back, ghost | UserTaskQueue, SidebarQueue, CardGridView, PMWorkspace |
| `IconButton` | Button | glass, ingrained, round | Sidebar, TabBar |
| `StatusDot` | — | active, idle, working, waiting, error + sizes | SessionList, StatusBar, AgentView, Overview |
| `ProgressBar` | — | default, large | ChildCardGrid, shared.tsx |
| `CollapsibleCard` | Card | tool, result, thinking, system variants | TurnGroup (5 card types) |
| `FileChip` | — | default, link | ChildCardGrid, NodeHeader, UserTaskQueue, SidebarQueue |
| `GlassPanel` | — | panel, card | Available for use |
| `PMBadge` | — | count, goal, blocked, task, dep, status colors, editable | NowNextLater, NodeHeader, Overview, AlertCards, etc. |

## State Management

Zustand stores in `src/stores/`:
- `chat-store` — message history, streaming, header info per session
- `session-store` — session statuses, metadata
- `tab-store` — dockview tabs, doc navigation, edit mode
- `pm-store` — project tree, node cache, file preview
- `docs-store` — file tree, doc loading, wikilink navigation
- `voice-store` — recording state, transcription
- `notification-store` — toast notifications
- `vault-index-store` — vault file index for wikilink resolution

## Adding New Components

**Pattern:** headless logic library + primitives + Tailwind layout = no CSS files.

```tsx
// Example: new feature component
import { ActionButton, StatusBadge } from '@/components/primitives'
import { Card } from '@/components/ui/card'

export function MyFeature() {
  return (
    <Card className="p-4 flex flex-col gap-3">
      <StatusBadge status="active" label="Running" />
      <ActionButton variant="approve" onClick={handle}>Approve</ActionButton>
    </Card>
  )
}
```

**Adding a shadcn component:** Copy from shadcn docs into `ui/`, it works immediately with design tokens.

**Adding a popup/dialog:** Use shadcn `Dialog` or `Popover` + primitives. Takes < 5 minutes.

## Tech Stack

- **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config, `@theme` directive)
- **Vite 7** (build + dev server)
- **shadcn/ui** (Radix-based primitives)
- **CVA** (class-variance-authority) for primitive variants
- **Zustand** for state management
- **dockview** for tabbed workspace panels
- **xterm.js** for terminal
- **CodeMirror 6** for markdown editing
- **Streamdown** for AI message rendering

# Locusly UI — Style Guide

## Elevation Model (3 layers)

```
Layer 0  —  Body canvas           --bg-base          warm gray / near-black
Layer 1  —  App panels            --bg-surface/panel  WHITE (light) / dark navy (dark)
Layer 3  —  Modals / toasts       --bg-overlay        semi-transparent + backdrop-filter blur
```

### Key rule
- `body { padding: 8px }` — background canvas shows around the panels (reveals Layer 0)
- Sidebar (`.sidebar`) and workspace (`.workspace`) are **peers at the same elevation** — both Layer 1
- In light mode: panels are pure white, body is warm gray → strong contrast = clearly elevated
- In dark mode: panels are solid dark navy, body is near-black → +28–32 lightness contrast

---

## Design Tokens

### Backgrounds (key ones)

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--bg-base` | `#E8E8EE` | `#0D0D14` | L0 body canvas |
| `--bg-surface` | `#FFFFFF` | `#1C1C2E` | L1 sidebar |
| `--bg-panel` | `#FFFFFF` | `#1F1F34` | L1 workspace |
| `--bg-overlay` | `rgba(255,255,255,0.95)` | `rgba(30,30,52,0.96)` | L3 modals/toasts (semi-transparent!) |
| `--bg-ingrained` | `var(--bg-base)` = `#E8E8EE` | `rgba(0,0,0,0.14)` | Buttons, chat area, active tabs |
| `--bg-ingrained-hover` | `#DDDDE5` | `rgba(0,0,0,0.22)` | Hover state of ingrained elements |
| `--bg-ingrained-active` | `#D2D2DA` | `rgba(0,0,0,0.30)` | Active/pressed state |
| `--bg-card` | `rgba(0,0,0,0.03)` | `rgba(255,255,255,0.04)` | Subtle card fill |
| `--bg-raised` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.08)` | Slightly raised within panel |

---

## Ingrained Pattern

"Ingrained" = an element that looks **pressed into** the panel surface, rather than floating above it.

### How it works
- **Light mode**: ingrained bg = `var(--bg-base)` = same warm gray as body → element appears to "fall back" to ground level
- **Dark mode**: ingrained bg = `rgba(0,0,0,0.14)` composited over panel = slightly darker than surface = recessed

### When to use `--bg-ingrained`
- All input-type buttons: send, cancel, mic, restart, notification bell
- Active/selected tabs (topbar tabs, sidebar tabs, inner Chat/Terminal pill)
- Chat content area (`.chat-container`) — the scroll area feels slightly recessed
- The Chat/Terminal segmented pill track (`.inner-tab-pill`)

### Ingrained button recipe
```css
.my-btn {
  background: var(--bg-ingrained);
  border: 1px solid var(--color-border-subtle);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.10);
  border-radius: var(--radius-md);
  transition: background var(--dur-fast) var(--ease-standard);
}
.my-btn:hover  { background: var(--bg-ingrained-hover); }
.my-btn:active { background: var(--bg-ingrained-active); }
```

### Anti-pattern: don't use rgba(255,255,255,0.07) for ingrained
On a dark panel, `rgba(255,255,255,0.07)` = lighter than surface = **raised**, not recessed.

---

## Terminal

The terminal canvas must match the panel background exactly so there's no seam.

- `.terminal-container { background: var(--bg-panel); }`
- xterm `TERM_THEME.background` must also equal `--bg-panel`:
  - Dark: `#1F1F34`
  - Light: `#FFFFFF`

Theme switching is done at module load time:
```ts
const TERM_THEME = window.matchMedia('(prefers-color-scheme: light)').matches
  ? TERM_THEME_LIGHT : TERM_THEME_DARK
```

---

## L3 Overlays (modals, toasts, drawers)

`--bg-overlay` **must stay semi-transparent** so `backdrop-filter: blur()` works.
- Dark: `rgba(30, 30, 52, 0.96)` ✓
- Light: `rgba(255, 255, 255, 0.95)` ✓
- ❌ Never use an opaque hex (e.g. `#2C2C48`) — kills frosted glass effect

---

## Borders

| Token | Light | Dark | Used for |
|-------|-------|------|---------|
| `--color-border` | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.08)` | Standard borders |
| `--color-border-subtle` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.05)` | Low-emphasis separators |
| `--color-border-glass` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` | Panel edges (sidebar/workspace) |

⚠️ In light mode `--color-border-glass` must be a DARK rgba (not white) — white border on white panel = invisible.

---

## Typography

- UI font: `Inter` via `var(--font-sans)`
- Mono font: `JetBrains Mono` via `var(--font-mono)`
- Base: 13px, line-height 1.55
- Chat messages: 14px, line-height 1.6
- Code/mono metadata: 11–12px

---

## Shadows

| Token | Used for |
|-------|---------|
| `--shadow-panel` | Sidebar + workspace panels (Layer 1) |
| `--shadow-float` | Vaul drawer, dropdowns, popovers |
| `--shadow-modal` | Dialog/modal overlays |
| `--shadow-card` | Inline elevated cards |
| `--glass-highlight` | Top-edge inner highlight on panels |

---

## Motion

| Token | Value | Used for |
|-------|-------|---------|
| `--dur-fast` | 80ms | Hover backgrounds, color changes |
| `--dur-normal` | 150ms | State transitions, reveals |
| `--dur-enter` | 200ms | Enter animations |
| `--dur-expand` | 250ms | Expanding panels/accordions |
| `--ease-standard` | `cubic-bezier(0.2,0,0,1)` | Most transitions |
| `--ease-enter` | `cubic-bezier(0,0,0.2,1)` | Entering elements |
| `--ease-spring` | `cubic-bezier(0.35,0,0.15,1.2)` | Springy micro-interactions |

---

## Mobile

- `body { padding: 0 }` on ≤768px — no background canvas visible
- Sidebar replaced by vaul Drawer (swipe from left edge)
- All interactive elements: `min-width/height: 40–44px` touch targets
- Inputs: `font-size: 16px !important` on mobile (prevents iOS zoom)
- `touch-action: manipulation` on all buttons/links (fast tap)
- `-webkit-tap-highlight-color: transparent` on all elements

---

## Accent Color

Primary accent: `#5BA3D9` (steel blue)

| Token | Value |
|-------|-------|
| `--color-accent` | `#5BA3D9` |
| `--color-accent-bright` | `#7CC1EE` |
| `--color-accent-dim` | `rgba(91,163,217,0.15)` |
| `--color-accent-glow` | `rgba(91,163,217,0.25)` |

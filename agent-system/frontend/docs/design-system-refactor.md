# Design System Refactor Plan

This audit covers the current frontend design system surface and the first migration path for normalizing typography and component usage.

## Current Shape

- Token entry: `src/styles/tokens.css`
- Global base styles: `src/styles/base.css`
- Legacy and third-party overrides: `src/styles/overrides.css`
- Shadcn-style components: `src/components/ui`
- Product primitives: `src/components/primitives`

The system already has useful foundations, but consumption is inconsistent. Typography, badge, button, panel, and color decisions are still repeated directly in feature files.

## Typography Audit

Arbitrary text utilities found in `src`:

| Value | Count |
| --- | ---: |
| `text-[11px]` | 344 |
| `text-[10px]` | 214 |
| `text-[12px]` | 114 |
| `text-[13px]` | 65 |
| `text-[9px]` | 29 |
| `text-[15px]` | 3 |

Top files by arbitrary text usage:

| File | Count |
| --- | ---: |
| `src/components/widgets/AgentsWidget.tsx` | 71 |
| `src/components/pm/GlobalSearch.tsx` | 67 |
| `src/components/pm/HomeScreen.tsx` | 45 |
| `src/components/pm/GoalsView.tsx` | 37 |
| `src/components/pm/ChildCardGrid.tsx` | 35 |
| `src/components/settings/AISettingsPage.tsx` | 31 |

Recommended mapping:

| Existing usage | New semantic use |
| --- | --- |
| `text-[9px]`, dense uppercase metadata | `Text variant="caption"` with uppercase classes only when needed |
| `text-[10px]` | `Text variant="caption"` |
| `text-[11px]` | `Text variant="micro"` |
| `text-[12px]`, `text-xs` | `Text variant="label"` |
| `text-[13px]`, root body text | `Text variant="bodySm"` |
| `text-sm` / 14px content | `Text variant="bodyMd"` |
| section/card headings | `Text variant="titleSm"` or `Text variant="titleMd"` |

## Component Audit

Use these as the canonical layers:

- Foundation: `tokens.css` for colors, typography, spacing, radius, shadows, status, and motion.
- UI components: `components/ui` for Radix/shadcn base components.
- Primitives: `components/primitives` for app-specific semantic components.
- Product components: feature folders such as `components/pm`, `components/widgets`, `components/workspace`, and `components/chat`.

Current duplicate patterns worth consolidating:

- Buttons: raw `<button>` classes, `Button`, `ActionButton`, and `IconButton` coexist.
- Badges: `Badge`, `PMBadge`, `StatusBadge`, and raw rounded spans coexist.
- Cards/panels: `Card`, `GlassPanel`, `CollapsibleCard`, `.glass-card`, `.entity-card`, and many raw card class strings coexist.
- Status colors: `status-utils.ts` is the intended source of truth, but several files still hardcode RGB/RGBA status tints.

## Canonical API

Typography should use `Text` from `src/components/primitives/text.tsx`:

```tsx
<Text variant="micro" tone="muted">
  Last updated
</Text>

<Text as="h3" variant="titleSm" weight="semibold">
  Active agents
</Text>
```

Buttons:

```tsx
<ActionButton variant="primary" size="sm" />
<ActionButton variant="secondary" />
<IconButton variant="ghost" size="sm" />
```

Status:

```tsx
<StatusBadge status={task.status} />
<PMBadge variant={groupBadgeVariants[statusToGroup(status)]} />
```

## Migration Order

1. Typography pass: replace arbitrary `text-[...]` in the top six files with `Text`.
2. Badge pass: replace raw pill spans with `PMBadge` or `StatusBadge`.
3. Button pass: replace raw icon/tool buttons with `IconButton` and command buttons with `ActionButton`.
4. Panel/card pass: choose `Card`, `GlassPanel`, or `CollapsibleCard` per use case and remove feature-level card recipes.
5. Color pass: replace raw RGB/RGBA status colors with tokens or `status-utils.ts`.
6. Guardrails: add lint/search checks for new arbitrary text sizes and raw status colors.

## Rules Going Forward

- New typography should use `Text` unless a third-party component requires a class override.
- New status presentation should import from `status-utils.ts`.
- New feature components should not define new color/status maps.
- Arbitrary Tailwind values are allowed for fixed layout mechanics, but not for typography scale.
- Product components can compose primitives, but primitives should not import product components.

# Agent System Design Guidelines

This guide defines the visual and interaction rules for Agent System. It uses the same kind of structure as the referenced Figma guideline: system sections, core principles, tokens, usage rules, and component states. The content is tailored to this product rather than copied from the reference.

## Product Principle

Agent System is a working cockpit for supervising many AI workstreams. The UI should feel calm, dense, legible, and operational. It should help users scan state, compare work, enter a thread, and recover context without feeling like a marketing site or a decorative dashboard.

Core rule: every surface should answer one of three questions.

| Question | Typical UI |
| --- | --- |
| What is happening now? | status badges, live agent cards, queue ticker, progress blocks |
| What needs my attention? | inbox items, blocked tasks, approval buttons, alerts |
| Where can I inspect or continue work? | project cards, workspace tabs, docs viewer, chat thread |

## System Sections

Use these sections when building a Figma page, implementation story, or design review:

1. Color system
2. Typography system
3. Status system
4. Button system
5. Card and panel system
6. Navigation and workspace layout
7. Agent-specific patterns
8. Motion and feedback

## Color System

The product is dark-first, glass-edged, and information-dense. Most of the interface should come from surfaces, borders, and text tokens. Accent colors should be used to clarify state or focus, not to decorate.

Source of truth: `frontend/src/styles/tokens.css`.

### Primary Colors

| Token | Value | Use |
| --- | --- | --- |
| `--bg-base` | `#181825` | app background |
| `--bg-surface` | `#232338` | structural surfaces |
| `--bg-panel` | `#272742` | workspace and sidebar panels |
| `--color-accent` | `#6E95F6` | focus, active state, primary action |
| `--color-accent-bright` | `#82A6FF` | stronger active or hover emphasis |

### Neutral Text

| Token | Value | Use |
| --- | --- | --- |
| `--color-text` | `#F0F0F5` | primary readable text |
| `--color-text-muted` | `#A0A0B2` | secondary labels and timestamps |
| `--color-text-subtle` | `#6A6A80` | low-priority metadata |
| `--color-text-ghost` | `#454558` | disabled or deeply backgrounded text |

### Status Colors

Agent System uses a 4-group status model. Do not create one-off status palettes in feature files.

| Group | Token | Meaning | Examples |
| --- | --- | --- | --- |
| Inactive | `--color-status-inactive` | not currently moving | todo, paused, shelved |
| Active | `--color-status-active` | work is in progress | active, executing, conversation |
| Attention | `--color-status-attention` | user or system is waiting | blocked, waiting, stalled |
| Complete | `--color-status-complete` | finished or resolved | done, complete |

Implementation rule: status rendering should go through `statusToGroup()` and `StatusBadge`, not a local color map.

## Typography System

Agent System typography should support scanning. Large display text is rare; the main UI is compact, with predictable label and metadata sizes.

Source of truth: `Text` in `frontend/src/components/primitives/text.tsx` and type tokens in `tokens.css`.

| Role | Token / Primitive Variant | Size | Use |
| --- | --- | ---: | --- |
| Caption | `caption` | 10px | compact metadata, dense chips |
| Micro | `micro` | 11px | secondary labels in cards and toolbars |
| Label | `label` | 12px | buttons, badges, compact controls |
| Body small | `bodySm` | 13px | default app copy |
| Body medium | `bodyMd` | 14px | readable document or panel copy |
| Title small | `titleSm` | 15px | card headings |
| Title medium | `titleMd` | 16px | panel headings |
| Title large | `titleLg` | 20px | major workspace section headings |

Rules:

- Use `Text` for new product typography.
- Avoid arbitrary `text-[...]` sizes unless a third-party integration requires it.
- Use `font-mono` only for paths, logs, command output, identifiers, and code.
- Keep uppercase labels short. Uppercase is for system metadata, not prose.

## Status System

Status is the most important visual grammar in the app. A user should be able to scan a page and understand which agents are moving, blocked, paused, or complete.

### Status Badge

Use `StatusBadge` for task, session, agent, and workflow state.

Default use:

```tsx
<StatusBadge status={task.status} />
```

Use for:

- task state
- agent run state
- session state
- compact status in cards, lists, tables, and headers

Do not use for:

- selectable filters
- primary actions
- decorative tags

### Status Dot

Use `StatusDot` when the label is already nearby or when the UI needs a compact live indicator.

Use for:

- live session list rows
- small toolbar presence
- compact agent cards

Do not rely on color alone. Pair dots with text, tooltip, or surrounding context.

## Button System

Buttons are for actions, not for status. If something changes a view, submits a choice, starts work, stops work, or opens a menu, it can be a button.

Source of truth: `ActionButton` and `IconButton` in `frontend/src/components/primitives`.

### Action Buttons

| Variant | Use |
| --- | --- |
| `primary` | main action in a local surface |
| `secondary` | normal command |
| `ghost` | low-emphasis command |
| `approve` | approval or positive confirmation |
| `done` | completion action |
| `back` | navigation back or return |
| `toolbar` | toolbar command |
| `toolbarPrimary` | most important toolbar command |
| `panel` | command embedded in a panel |
| `appShell` | shell-level command |
| `chip` | compact chip-like command |
| `destructive` | irreversible or high-risk action |

Rules:

- Prefer icon-only buttons for common tool actions when a familiar icon exists.
- Use text buttons for commands where the verb matters.
- Destructive actions must be explicit and visually distinct.
- Disabled buttons should explain themselves through nearby state or tooltip when the reason is not obvious.

### Icon Buttons

Use `IconButton` for repeated shell and toolbar controls.

Use for:

- sidebar collapse and expand
- tab close
- copy
- open, search, refresh, settings
- input send or voice controls

Rules:

- Use lucide icons where available.
- Provide accessible labels.
- Keep dimensions stable; hover should not resize the toolbar.

## Card And Panel System

Core principle: decide the role first.

| Surface | Meaning | Use |
| --- | --- | --- |
| Card | A bounded content object | project card, task card, queue item, artifact preview |
| Panel | A structural area of the screen | sidebar, workspace column, modal body, docs viewer |
| Collapsible card | A progressive disclosure block | tool call, result, thinking, system message |

### Card

Use `GlassPanel variant="card"` or the shadcn `Card` when the element represents one selectable or inspectable unit.

Use for:

- live agent card
- past agent card
- queue card
- file chip group with preview
- project or task summary

Rules:

- Cards should have one clear heading or primary label.
- Keep card radius at the established card radius unless a primitive says otherwise.
- Hover may lift a card only when the card is clickable.
- Avoid cards inside cards. Use rows, sections, or separators inside a card.

### Panel

Use `GlassPanel variant="panel"` or `.glass-panel` for structural containment.

Use for:

- app sidebar
- workspace shell
- docs viewer
- chat panel
- settings pane
- modal or overlay body

Rules:

- Panels can contain cards, controls, and documents.
- Panels should not look like repeated list items.
- A panel heading should describe the workspace or mode, not a single object.

### Collapsible Card

Use `CollapsibleCard` for chat and agent trace content that expands and collapses.

Use for:

- tool call details
- tool result blocks
- thinking or system trace
- compact error details

Rules:

- Header must remain readable when collapsed.
- Body content should not change the surrounding layout unexpectedly.
- Error variants should use semantic error tokens, not custom red classes.

## Navigation And Workspace Layout

The app is a cockpit, so navigation should prioritize return paths and context continuity.

Rules:

- Keep the app shell stable while content changes.
- Preserve visible context: project, task, session, and current artifact should be identifiable without reading the whole page.
- Tabs are for parallel work surfaces. Cards are for objects. Buttons are for commands.
- Empty states should offer the next useful action, not a feature explanation.
- Mobile layouts should collapse navigation and preserve the current task surface first.

## Agent-Specific Patterns

### Agent Card

An agent card should answer:

- what the agent is doing
- whether it needs attention
- where to inspect the work
- when it last changed

Required elements:

- title or task name
- status badge or dot
- short current activity
- primary inspect or continue action

Optional elements:

- progress
- project/domain reference
- artifact count
- last update time

### Queue Item

A queue item should feel actionable, not archival.

Required elements:

- requested action or decision
- related project/task
- urgency or status
- approve, open, resolve, or dismiss action where relevant

### Chat And Tool Trace

Chat is a workspace, not just messaging.

Rules:

- User and assistant messages should remain visually distinct.
- Tool calls should be compact by default and expandable when details matter.
- File references should use chips or links with stable affordances.
- Long generated content should be readable in the docs/workspace area when possible, not trapped in a tiny chat bubble.

## Motion And Feedback

Motion should clarify cause and effect. It should not make the app feel slower.

Source of truth: motion tokens in `tokens.css`.

| Token | Use |
| --- | --- |
| `--dur-fast` | tap/press response |
| `--dur-normal` | hover and simple state changes |
| `--dur-enter` | popovers and small panels entering |
| `--dur-expand` | collapsible content |
| `--dur-complex` | larger layout changes |

Rules:

- Hover and press feedback should be immediate.
- Progress and streaming states should be visible without excessive animation.
- Respect reduced motion preferences when adding new motion.
- Avoid animation that shifts reading position during active work.

## Implementation Checklist

Before shipping a new UI surface:

- Uses existing tokens from `tokens.css`.
- Uses `Text`, `ActionButton`, `IconButton`, `StatusBadge`, `StatusDot`, `GlassPanel`, or `CollapsibleCard` where applicable.
- Does not introduce raw status colors.
- Does not introduce arbitrary typography sizes without a reason.
- Distinguishes cards, panels, tabs, badges, and buttons by role.
- Has hover, active, disabled, loading, and empty states where the workflow needs them.
- Keeps dense operational screens scannable on desktop and usable on mobile.

## Figma Guideline Page Shape

If this is recreated in Figma, use this page order:

1. Cover: Agent System Design Guidelines
2. Principles: cockpit, context, attention, continuity
3. Color system: surfaces, text, accent, status
4. Typography system: role table and examples
5. Status system: badge and dot states
6. Button system: variants, padding, icon rules, disabled states
7. Card and panel system: role comparison and layout examples
8. Agent patterns: agent card, queue item, tool trace
9. Motion and feedback: duration tokens and interaction examples
10. Implementation checklist: designer and developer handoff rules

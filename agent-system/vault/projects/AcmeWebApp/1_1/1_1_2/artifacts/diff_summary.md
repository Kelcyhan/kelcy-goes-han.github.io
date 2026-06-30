# Primitives Migration Diff Summary

Migration of `Button` + `Input` + form primitives from hardcoded literals to design tokens.

## Files touched

| File | LOC changed | Notes |
|------|-------------|-------|
| `src/components/ui/button.tsx`        | +18 / −24 | Variant `cva` slots now reference CSS vars |
| `src/components/ui/input.tsx`         | +12 / −15 | Border + focus ring tokenized |
| `src/components/ui/form.tsx`          | +24 / −11 | FormField wraps semantic state slots |
| `src/components/ui/label.tsx`         | +3  / −4  | Color → semantic neutral |
| `src/components/ui/select.tsx`        | +9  / −12 | Pulled focus ring into shared mixin |

## Visual regressions

Three primitives had ±1px visual diff in screenshot tests:

1. **Button (md size)** — padding shifted from 9px → 8px (now matches `--space-2`)
2. **Input (sm size)** — radius changed from 3px → 4px (snapped to `--radius-sm`)
3. **Select (open state)** — popover shadow changed offset by 1px

All three are intentional snaps to the token grid. Updated baselines accordingly.

## Open issues

- [ ] `FormField` doesn't yet expose a `state` prop for downstream consumers
- [ ] Need to tokenize the `Switch` component (deferred — used in only 2 places)
- [ ] Audit `DateRangePicker` next sprint

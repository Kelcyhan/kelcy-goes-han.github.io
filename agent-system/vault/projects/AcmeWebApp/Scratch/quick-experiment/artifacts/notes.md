# View Transitions Spike — Notes

## Findings

- **Chrome 117+**: Works as expected. Crossfade and per-element `view-transition-name` both fine.
- **Safari 18+**: Works. Confirmed on iOS 18.2 simulator.
- **Firefox**: Not yet supported (flag `dom.viewTransitions.enabled` exists in 126+, off by default).
- **Fallback**: `@supports (view-transition-name: x)` works. Non-supporting browsers just see instant swap.

## Recommendation

Adopt for **settings flow first** — it's a contained area with clear before/after states and limited
blast radius. Re-evaluate for the main shell after 4 weeks of production data.

## Open questions

- Should we add a global `prefers-reduced-motion` short-circuit? (Probably yes.)
- How does this interact with TanStack Router's route preloading? (Untested.)

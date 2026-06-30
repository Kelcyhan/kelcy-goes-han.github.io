// Mutual-exclusion bus for floating chat widgets (helper, concierge, …).
// Only one panel is visible at a time: when one opens, peers are minimized.
// Minimize preserves their session — Close is the only path that ends one.

type MinimizeCallback = () => void

const minimizers = new Map<string, MinimizeCallback>()

export function registerFloatingChat(variant: string, minimize: MinimizeCallback): () => void {
  minimizers.set(variant, minimize)
  return () => {
    if (minimizers.get(variant) === minimize) minimizers.delete(variant)
  }
}

export function minimizeOtherFloatingChats(self: string): void {
  for (const [variant, minimize] of minimizers) {
    if (variant !== self) minimize()
  }
}

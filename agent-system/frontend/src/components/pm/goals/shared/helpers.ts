import { useState, useCallback, useRef } from 'react'

// --- Formatting ---

export function formatBuffer(hours: number): string {
  const abs = Math.abs(hours)
  if (abs >= 48) return `${Math.round(abs / 24)}d`
  return `${abs}h`
}

// --- Status breakdown ---

export interface StatusCounts {
  done: number
  executing: number
  todo: number
  shelved: number
  other: number
  total: number
}

export function computeStatusCounts(tasks: { status: string }[]): StatusCounts {
  let done = 0, executing = 0, todo = 0, shelved = 0, other = 0
  for (const t of tasks) {
    switch (t.status) {
      case 'done': done++; break
      case 'active': case 'executing': executing++; break
      case 'todo': todo++; break
      case 'shelved': shelved++; break
      case 'dropped': other++; break
      default: todo++; break
    }
  }
  return { done, executing, todo, shelved, other, total: tasks.length }
}

// --- Collapse state persistence ---

export function useCollapsed(key: string, defaultOpen = true) {
  const storageKey = `goal-section-${key}`
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored !== null ? stored === 'true' : defaultOpen
    } catch { return defaultOpen }
  })
  const toggle = useCallback(() => {
    setOpen((prev: boolean) => {
      const next = !prev
      try { localStorage.setItem(storageKey, String(next)) } catch {}
      return next
    })
  }, [storageKey])
  return { open, toggle }
}

// --- Action toast ---

export interface ActionToast {
  message: string
  type: 'success' | 'error'
}

export function useActionToast(duration = 3000) {
  const [toast, setToast] = useState<ActionToast | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, type })
    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [duration])

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  return { toast, show, dismiss }
}

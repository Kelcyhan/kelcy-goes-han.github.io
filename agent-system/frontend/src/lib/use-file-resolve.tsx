/**
 * Shared file resolution hook for doc viewers.
 *
 * When a link's resolved path doesn't exist on the server, falls back to
 * filename search and shows a picker popup — same behaviour as chat's
 * useFilePathClick.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FileText } from 'lucide-react'
import { searchVaultFiles } from '@/lib/api.ts'

interface PopupState {
  results: { name: string; path: string }[]
  x: number
  y: number
}

async function exists(path: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/vault/file?path=${encodeURIComponent(path)}`)
    return r.ok
  } catch { return false }
}

export function useFileResolve(onNavigate: (path: string) => void) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  const resolve = useCallback(async (resolvedPath: string, e: React.MouseEvent) => {
    // 1. Try resolved path directly
    if (await exists(resolvedPath)) {
      onNavigateRef.current(resolvedPath)
      return
    }

    // 2. Search by filename
    const filename = resolvedPath.split('/').pop() || resolvedPath
    try {
      const data = await searchVaultFiles(filename, undefined, 15)
      const matches = (data.results || []).filter((r: any) =>
        r.name === filename || r.path.endsWith('/' + filename)
      )
      if (matches.length === 0) return
      if (matches.length === 1) {
        onNavigateRef.current(matches[0].path)
        return
      }
      // Sort: shorter paths (more specific) first
      matches.sort((a: any, b: any) => a.path.length - b.path.length)
      const rect = (e.target as Element).getBoundingClientRect()
      setPopup({ results: matches.slice(0, 8), x: rect.left, y: rect.bottom + 4 })
    } catch {}
  }, [])

  const PopupEl = popup ? (
    <FileResolvePopup
      results={popup.results}
      x={popup.x}
      y={popup.y}
      onSelect={(path) => { setPopup(null); onNavigateRef.current(path) }}
      onClose={() => setPopup(null)}
    />
  ) : null

  return { resolve, PopupEl }
}

function FileResolvePopup({ results, x, y, onSelect, onClose }: {
  results: { name: string; path: string }[]
  x: number; y: number
  onSelect: (path: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[100] rounded-lg border border-[var(--color-border-glass)] bg-popover shadow-[var(--shadow-float)] overflow-hidden min-w-[220px] max-w-[420px]"
      style={{ left: Math.min(x, window.innerWidth - 440), top: Math.min(y, window.innerHeight - 200) }}
    >
      <div className="px-2 py-1.5 type-caption text-muted-foreground uppercase tracking-wide border-b border-[var(--color-border)]">
        Multiple matches — pick one
      </div>
      {results.map((r) => (
        <div
          key={r.path}
          className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-[var(--bg-ingrained)] transition-colors"
          onClick={() => onSelect(r.path)}
        >
          <FileText size={12} className="text-muted-foreground shrink-0" />
          <span className="truncate text-muted-foreground">{r.path}</span>
        </div>
      ))}
    </div>,
    document.body,
  )
}

import { useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Code, FileCode, FileType } from 'lucide-react'

const HOVER_DELAY_MS = 500
import { useTabStore } from '@/stores/tab-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { workingDirPrefix } from '@/lib/paths.ts'
import { vaultPreviewUrl, searchVaultFiles, getAuthToken } from '@/lib/api.ts'
import { ActionButton } from '@/components/primitives'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])
const CODE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'rb', 'c', 'cpp', 'h', 'hpp', 'java', 'kt', 'swift', 'lua', 'sh', 'bash', 'fish'])
const MARKUP_EXTS = new Set(['md', 'mdx', 'txt', 'rst', 'org', 'yaml', 'yml', 'toml', 'json', 'xml', 'html', 'css'])

function pickIcon(ext: string) {
  if (IMAGE_EXTS.has(ext)) return ImageIcon
  if (CODE_EXTS.has(ext)) return Code
  if (ext === 'pdf') return FileType
  if (MARKUP_EXTS.has(ext)) return FileText
  return FileCode
}

interface FileChipInlineProps {
  path: string
  ext?: string
}

export function FileChipInline({ path, ext }: FileChipInlineProps) {
  const extLower = (ext || path.split('.').pop() || '').toLowerCase()
  const Icon = pickIcon(extLower)
  const filename = path.split('/').pop() || path
  const isImage = IMAGE_EXTS.has(extLower)
  const [resolved, setResolved] = useState<string | null>(null)
  const [hoveringImg, setHoveringImg] = useState(false)
  const openDocTab = useTabStore(s => s.openDocTab)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    // Reuse the same cascade logic as TurnGroup.useFilePathClick
    const { sessions, activeSession, vaultRoot } = useSessionStore.getState()
    const session = sessions.find(s => s.name === activeSession)
    const taskDir = session?.task_path
      ? session.task_path.substring(0, session.task_path.lastIndexOf('/'))
      : ''

    const vr = vaultRoot || '/home/agent/vault'
    const vrPrefix = vr.endsWith('/') ? vr : vr + '/'
    const normalized = path.startsWith(vrPrefix) ? path.slice(vrPrefix.length) : path.startsWith('/') ? path : path

    const exists = async (p: string) => {
      try {
        const resp = await fetch(`/api/vault/file?path=${encodeURIComponent(p)}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
        return resp.ok
      } catch { return false }
    }

    if (await exists(normalized)) {
      openDocTab(normalized, e.ctrlKey || e.metaKey)
      return
    }
    if (taskDir) {
      const withTaskDir = taskDir + '/' + normalized
      if (await exists(withTaskDir)) {
        openDocTab(withTaskDir, e.ctrlKey || e.metaKey)
        return
      }
    }
    if (session?.working_dir) {
      const wdp = workingDirPrefix(session.working_dir, vaultRoot)
      if (wdp && wdp !== normalized) {
        const withWd = wdp + '/' + normalized
        if (await exists(withWd)) {
          openDocTab(withWd, e.ctrlKey || e.metaKey)
          return
        }
      }
    }
    try {
      const data = await searchVaultFiles(filename, undefined, 5)
      const matches = (data.results || []).filter((r: any) => r.name === filename || r.path.endsWith('/' + filename))
      if (matches.length > 0) {
        openDocTab(matches[0].path, e.ctrlKey || e.metaKey)
      }
    } catch {}
  }

  // For images, eagerly resolve a working path so the thumbnail hover works
  const resolvePreviewPath = async () => {
    if (resolved !== null) return resolved
    const { sessions, activeSession, vaultRoot } = useSessionStore.getState()
    const session = sessions.find(s => s.name === activeSession)
    const taskDir = session?.task_path ? session.task_path.substring(0, session.task_path.lastIndexOf('/')) : ''
    const vr = vaultRoot || '/home/agent/vault'
    const vrPrefix = vr.endsWith('/') ? vr : vr + '/'
    const normalized = path.startsWith(vrPrefix) ? path.slice(vrPrefix.length) : path.startsWith('/') ? path : path
    const candidates: string[] = [normalized]
    if (taskDir) candidates.push(taskDir + '/' + normalized)
    if (session?.working_dir) {
      const wdp = workingDirPrefix(session.working_dir, vaultRoot)
      if (wdp && wdp !== normalized) candidates.push(wdp + '/' + normalized)
    }
    for (const c of candidates) {
      try {
        const r = await fetch(`/api/vault/file?path=${encodeURIComponent(c)}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
        if (r.ok) { setResolved(c); return c }
      } catch {}
    }
    setResolved(normalized)
    return normalized
  }

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelHover = () => { if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null } }
  const onEnter = () => {
    if (!isImage) return
    cancelHover()
    hoverTimerRef.current = setTimeout(() => { resolvePreviewPath(); setHoveringImg(true) }, HOVER_DELAY_MS)
  }
  const onLeave = () => { cancelHover(); setHoveringImg(false) }

  return (
    <span className="relative inline-block">
      <ActionButton
        variant="chip"
        size="chip"
        onClick={handleClick}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className="px-1.5 py-px rounded text-foreground [&_svg]:shrink-0"
        title={path}
      >
        <Icon size={11} className="text-muted-foreground" />
        <span className="font-mono">{filename}</span>
      </ActionButton>
      {isImage && hoveringImg && resolved && (
        <span className="absolute z-50 left-0 top-full mt-1 block pointer-events-none">
          <img
            src={vaultPreviewUrl(resolved)}
            alt={filename}
            className="block max-h-72 max-w-md rounded border border-[var(--color-border)] shadow-[var(--shadow-float)] bg-[var(--bg-base)]"
          />
        </span>
      )}
    </span>
  )
}

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Turn, Message, ContentBlock, ToolUseBlock, ToolResultBlock, ThinkingBlock as ThinkingBlockType, MessageSubtype } from '@/lib/types.ts'
import { formatToolPreview } from '@/lib/markdown.ts'
import { vaultPreviewUrl, searchVaultFiles, searchVaultDirs, resolveTaskPath, getAuthToken } from '@/lib/api.ts'
import { normalizeVaultPath, workingDirPrefix } from '@/lib/paths.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { isVaultPath, isTaskRef, isSessionName, isFolderPath, isClickableCode } from '@/lib/clickable-code.ts'
import { chatChipComponents, chatChipRemarkPlugins, chatChipAllowedTags } from '@/components/chat/chips'
import { MessageResponse } from '@/components/ai-elements/message.tsx'
import { CollapsibleCard, CollapsibleCardHeader, CollapsibleCardBody, IconButton } from '@/components/primitives'
import {
  CheckCircle2, XCircle, ChevronRight, Copy, Check,
  Wrench, Terminal, FileText, Search, Globe, Pencil, Eye,
  Link2, Zap, Bot, Ban
} from 'lucide-react'


interface TurnGroupProps {
  turn: Turn
}

// ---------------------------------------------------------------------------
// Flatten steps into render items: thinking/text/system are "outer",
// tool_use/tool_result are grouped into collapsible "tools" sections.
// ---------------------------------------------------------------------------

type ToolGroupItem =
  | { kind: 'block'; block: ContentBlock }
  | { kind: 'system'; message: Message }

type RenderItem =
  | { kind: 'system'; message: Message }
  | { kind: 'thinking'; block: ThinkingBlockType }
  | { kind: 'text'; text: string }
  | { kind: 'tools'; items: ToolGroupItem[] }

/** Subtypes that should be collapsed inside tool groups rather than rendered at top level. */
const INNER_SUBTYPES = new Set<string>(['hook', 'local_command'])

function flattenSteps(steps: Message[]): RenderItem[] {
  const items: RenderItem[] = []
  let toolBuffer: ToolGroupItem[] = []

  const flushTools = () => {
    if (toolBuffer.length > 0) {
      items.push({ kind: 'tools', items: [...toolBuffer] })
      toolBuffer = []
    }
  }

  for (const step of steps) {
    if (step.subtype) {
      if (INNER_SUBTYPES.has(step.subtype)) {
        toolBuffer.push({ kind: 'system', message: step })
      } else {
        flushTools()
        items.push({ kind: 'system', message: step })
      }
      continue
    }

    if (!step.content) continue

    for (const block of step.content) {
      if (block.type === 'thinking') {
        // Only render thinking blocks that have content (JSONL strips thinking text)
        if ((block as ThinkingBlockType).thinking?.trim()) {
          flushTools()
          items.push({ kind: 'thinking', block: block as ThinkingBlockType })
        }
      } else if (block.type === 'text') {
        flushTools()
        if ((block as any).text?.trim()) {
          items.push({ kind: 'text', text: (block as any).text })
        }
      } else if (block.type === 'tool_use' || block.type === 'tool_result') {
        toolBuffer.push({ kind: 'block', block })
      }
    }
  }
  flushTools()

  return items
}

/** Subtypes that render at L1 (outside Working section). agent_message is no
 *  longer here — it now opens its own turn via groupMessagesIntoTurns and
 *  renders as a SystemCard at the turn-opener position. */
const L1_SUBTYPES = new Set<string>(['interrupt'])

export function TurnGroup({ turn }: TurnGroupProps) {
  const items = useMemo(() => flattenSteps(turn.steps), [turn.steps])

  // Bootstrap turns (SessionStart hook + bookkeeping tool calls + mechanical
  // "Session ID recorded" finalMsg) render normally, expanded by default. The
  // isBootstrapTurn helper is still used by ChatContainer's resume-scroll anchor
  // to skip mechanical turns when picking the visible top.

  // Split into L1 (outside Working) and L2 (inside Working)
  const l1Items = items.filter(i => i.kind === 'system' && L1_SUBTYPES.has(i.message.subtype || ''))
  const l2Items = items.filter(i => !(i.kind === 'system' && L1_SUBTYPES.has(i.message.subtype || '')))

  return (
    <div className="mb-4 animate-fade-in flex flex-col">
      {turn.userMsg && (
        turn.userMsg.subtype === 'agent_message'
          ? <SystemCard message={turn.userMsg} />
          : <UserMessage content={turn.userMsg.content} />
      )}
      {l2Items.length > 0 && <WorkingSection items={l2Items} />}
      {l1Items.map((item, i) =>
        item.kind === 'system' ? <SystemCard key={`l1-${i}`} message={item.message} /> : null
      )}
      {turn.finalMsg && <AssistantMessage message={turn.finalMsg} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Working section — collapsible L2 wrapper for intermediate output
// ---------------------------------------------------------------------------

function WorkingSection({ items }: { items: RenderItem[] }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="my-1.5">
      <div
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer text-xs text-muted-foreground px-2 py-1 select-none transition-colors duration-200 hover:text-foreground inline-flex items-center gap-1"
      >
        <ChevronRight size={10} className={`transition-transform duration-200 shrink-0 text-muted-foreground ${expanded ? 'rotate-90' : ''}`} />
        <span className="opacity-60">Working</span>
      </div>
      {expanded && (
        <div className="ml-2 pl-3 border-l-2 border-[var(--color-border-subtle)]">
          {items.map((item, i) => {
            if (item.kind === 'system') return <SystemCard key={`s-${i}`} message={item.message} />
            if (item.kind === 'thinking') return <ThinkingBlock key={`t-${i}`} block={item.block} />
            if (item.kind === 'text') return <IntermediateText key={`x-${i}`} text={item.text} />
            if (item.kind === 'tools') return <ToolGroup key={`g-${i}`} items={item.items} />
            return null
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Intermediate text — L2 assistant text (smaller/dimmer than final message)
// ---------------------------------------------------------------------------

function IntermediateText({ text }: { text: string }) {
  return <LocalMessageResponse text={text} wrapperClassName="text-sm leading-relaxed py-1 relative" />
}

// ---------------------------------------------------------------------------
// User message
// ---------------------------------------------------------------------------

type TextSegment = { type: 'text'; text: string }
type FileAttachmentSegment = {
  type: 'file-attachment'
  path: string
  name: string
  isImage: boolean
}
type TaskNotifSegment = {
  type: 'task-notification'
  taskId: string; toolUseId: string; outputFile: string; status: string; summary: string
}
type SubagentNotifSegment = {
  type: 'subagent-notification'
  agentId: string
  status: string
  summary: string
}
type LocalCmdSegment = {
  type: 'local-command'
  caveat: string; name: string; message: string; args: string; stdout: string
}
type Segment = TextSegment | FileAttachmentSegment | TaskNotifSegment | SubagentNotifSegment | LocalCmdSegment

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

function getInnerTag(html: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
  const m = html.match(re)
  return m ? m[1].trim() : ''
}

function parseUserText(text: string): Segment[] {
  type RawMatch = { start: number; end: number; segment: Segment }
  const rawMatches: RawMatch[] = []

  const tnRe = /<task-notification>([\s\S]*?)<\/task-notification>/g
  let m: RegExpExecArray | null
  while ((m = tnRe.exec(text)) !== null) {
    const inner = m[1]
    rawMatches.push({
      start: m.index, end: m.index + m[0].length,
      segment: {
        type: 'task-notification',
        taskId:     getInnerTag(inner, 'task-id'),
        toolUseId:  getInnerTag(inner, 'tool-use-id'),
        outputFile: getInnerTag(inner, 'output-file'),
        status:     getInnerTag(inner, 'status'),
        summary:    getInnerTag(inner, 'summary'),
      },
    })
  }

  const snRe = /<subagent_notification>([\s\S]*?)<\/subagent_notification>/g
  while ((m = snRe.exec(text)) !== null) {
    let agentId = ''
    let status = 'completed'
    let summary = ''
    try {
      const payload = JSON.parse(m[1].trim())
      agentId = String(payload?.agent_id || '')
      const statusObj = payload?.status
      if (statusObj && typeof statusObj === 'object') {
        const [statusKey, statusValue] = Object.entries(statusObj)[0] || []
        status = statusKey ? String(statusKey) : status
        summary = typeof statusValue === 'string' ? statusValue : JSON.stringify(statusValue)
      } else if (typeof statusObj === 'string') {
        summary = statusObj
      }
    } catch {
      summary = m[1].trim()
    }
    rawMatches.push({
      start: m.index, end: m.index + m[0].length,
      segment: {
        type: 'subagent-notification',
        agentId,
        status,
        summary,
      },
    })
  }

  const lcRe = /<local-command-caveat>[\s\S]*?<\/local-command-stdout>/g
  while ((m = lcRe.exec(text)) !== null) {
    const raw = m[0]
    rawMatches.push({
      start: m.index, end: m.index + m[0].length,
      segment: {
        type: 'local-command',
        caveat:  getInnerTag(raw, 'local-command-caveat'),
        name:    getInnerTag(raw, 'command-name'),
        message: getInnerTag(raw, 'command-message'),
        args:    getInnerTag(raw, 'command-args'),
        stdout:  getInnerTag(raw, 'local-command-stdout'),
      },
    })
  }

  // File attachments: backtick-wrapped absolute file paths
  const fileRe = /`(\/[^\s`]+\.[a-zA-Z0-9]+)`/g
  while ((m = fileRe.exec(text)) !== null) {
    const filePath = m[1]
    const fileName = filePath.split('/').pop() || filePath
    const ext = '.' + fileName.split('.').pop()?.toLowerCase()
    rawMatches.push({
      start: m.index, end: m.index + m[0].length,
      segment: {
        type: 'file-attachment',
        path: filePath,
        name: fileName,
        isImage: IMAGE_EXTENSIONS.has(ext),
      },
    })
  }

  if (rawMatches.length === 0) {
    return text.trim() ? [{ type: 'text', text }] : []
  }

  rawMatches.sort((a, b) => a.start - b.start)

  const segments: Segment[] = []
  let pos = 0
  for (const match of rawMatches) {
    const before = text.slice(pos, match.start).trim()
    if (before) segments.push({ type: 'text', text: before })
    segments.push(match.segment)
    pos = match.end
  }
  const after = text.slice(pos).trim()
  if (after) segments.push({ type: 'text', text: after })

  return segments
}

function UserMessage({ content }: { content: ContentBlock[] }) {
  const vaultRoot = useSessionStore(s => s.vaultRoot)
  const text = content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('\n')

  const segments = parseUserText(text)

  // Separate file attachments from text content for layout
  const textSegments = segments.filter(s => s.type !== 'file-attachment')
  const fileSegments = segments.filter((s): s is FileAttachmentSegment => s.type === 'file-attachment')

  return (
    <div className="chat-user-bubble self-end max-w-[85%] min-w-0 animate-fade-in bg-[var(--color-accent-dim)] border border-[var(--color-border-accent)] rounded-[12px_12px_4px] px-3.5 py-2.5">
      {textSegments.map((seg, i) => {
        if (seg.type === 'task-notification') return <TaskNotifCard key={i} seg={seg} />
        if (seg.type === 'subagent-notification') return <SubagentNotifCard key={i} seg={seg} />
        if (seg.type === 'local-command')     return <LocalCmdCard key={i} seg={seg} />
        return <div key={i} className="text-sm leading-normal whitespace-pre-wrap break-words">{seg.text}</div>
      })}
      {fileSegments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1.5">
          {fileSegments.map((seg, i) => (
            <FileAttachmentChip key={`f-${i}`} seg={seg} vaultRoot={vaultRoot} />
          ))}
        </div>
      )}
    </div>
  )
}

function FileAttachmentChip({ seg, vaultRoot }: { seg: FileAttachmentSegment; vaultRoot: string | null }) {
  const openDocTab = useTabStore(s => s.openDocTab)
  const relativePath = normalizeVaultPath(seg.path, vaultRoot)

  if (seg.isImage) {
    const src = vaultPreviewUrl(relativePath)
    return (
      <div
        className="cursor-pointer rounded-md overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
        onClick={() => openDocTab(relativePath, false)}
        title={seg.name}
      >
        <img src={src} alt={seg.name} className="block h-20 max-w-[160px] object-cover" />
      </div>
    )
  }

  return (
    <div
      className="cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--color-border)] text-xs text-muted-foreground hover:border-[var(--color-accent)] hover:text-foreground transition-colors"
      onClick={() => openDocTab(relativePath, false)}
      title={seg.path}
    >
      <FileText size={12} />
      <span className="truncate max-w-[150px]">{seg.name}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task notification card (item #6 — improved)
// ---------------------------------------------------------------------------

function TaskNotifCard({ seg }: { seg: TaskNotifSegment }) {
  const [expanded, setExpanded] = useState(false)
  const ok = seg.status === 'completed'
  return (
    <CollapsibleCard variant={ok ? 'system-success' : 'system-error'} className="w-full">
      <CollapsibleCardHeader className="gap-2 text-xs" onClick={() => setExpanded(!expanded)}>
        <span className={`shrink-0 flex items-center font-bold type-micro ${ok ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
          {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        </span>
        <span className="font-mono font-semibold shrink-0">Task {seg.taskId}</span>
        <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1">{seg.summary}</span>
        <ChevronRight size={12} className={`transition-transform duration-200 shrink-0 text-muted-foreground ${expanded ? 'rotate-90' : ''}`} />
      </CollapsibleCardHeader>
      {expanded && (
        <CollapsibleCardBody className="p-2.5 font-mono type-micro leading-relaxed bg-[var(--bg-base)] text-muted-foreground">
          <div><strong>Status:</strong> {seg.status}</div>
          {seg.outputFile && <div><strong>Output:</strong> <code className="bg-transparent p-0 type-micro break-all">{seg.outputFile}</code></div>}
          {seg.toolUseId  && <div><strong>Tool use ID:</strong> {seg.toolUseId}</div>}
        </CollapsibleCardBody>
      )}
    </CollapsibleCard>
  )
}

function SubagentNotifCard({ seg }: { seg: SubagentNotifSegment }) {
  const [expanded, setExpanded] = useState(false)
  const ok = seg.status === 'completed'
  const preview = seg.summary.replace(/\s+/g, ' ').trim()
  return (
    <CollapsibleCard variant={ok ? 'system-success' : 'system-error'} className="w-full">
      <CollapsibleCardHeader className="gap-2 text-xs" onClick={() => setExpanded(!expanded)}>
        <span className={`shrink-0 flex items-center font-bold type-micro ${ok ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
          {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        </span>
        <span className="font-mono font-semibold shrink-0">Subagent {seg.agentId.slice(0, 8) || '?'}</span>
        <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1">{preview}</span>
        <ChevronRight size={12} className={`transition-transform duration-200 shrink-0 text-muted-foreground ${expanded ? 'rotate-90' : ''}`} />
      </CollapsibleCardHeader>
      {expanded && (
        <CollapsibleCardBody className="p-2.5 font-mono type-micro leading-relaxed bg-[var(--bg-base)] text-muted-foreground">
          <div><strong>Status:</strong> {seg.status}</div>
          {seg.agentId && <div><strong>Agent ID:</strong> {seg.agentId}</div>}
          {seg.summary && <div className="mt-1.5 whitespace-pre-wrap break-words">{seg.summary}</div>}
        </CollapsibleCardBody>
      )}
    </CollapsibleCard>
  )
}

function LocalCmdCard({ seg }: { seg: LocalCmdSegment }) {
  const [expanded, setExpanded] = useState(false)
  const label = [seg.name, seg.args].filter(Boolean).join(' ') || seg.message
  const stdoutPreview = seg.stdout.split('\n')[0].slice(0, 80)
  return (
    <CollapsibleCard variant="system" className="w-full">
      <CollapsibleCardHeader className="gap-2 text-xs" onClick={() => setExpanded(!expanded)}>
        <span className="shrink-0 flex items-center text-muted-foreground">
          <Terminal size={12} />
        </span>
        <span className="font-mono font-semibold shrink-0">{label}</span>
        {stdoutPreview && (
          <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1">{stdoutPreview}</span>
        )}
        <ChevronRight size={12} className={`transition-transform duration-200 shrink-0 text-muted-foreground ${expanded ? 'rotate-90' : ''}`} />
      </CollapsibleCardHeader>
      {expanded && (
        <CollapsibleCardBody className="p-2.5 font-mono type-micro leading-relaxed bg-[var(--bg-base)] text-muted-foreground">
          {seg.caveat && <div className="text-muted-foreground italic mb-1.5 type-caption">{seg.caveat}</div>}
          {seg.stdout && <pre className="m-0 whitespace-pre-wrap break-words">{seg.stdout}</pre>}
        </CollapsibleCardBody>
      )}
    </CollapsibleCard>
  )
}

// ---------------------------------------------------------------------------
// Assistant message (item #1 — CodeBlock via MessageResponse / Streamdown)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// File path resolution — shared click handler with search fallback + popup
// ---------------------------------------------------------------------------

function useFilePathClick() {
  const openDocTab = useTabStore(s => s.openDocTab)
  const vaultRoot = useSessionStore(s => s.vaultRoot)
  const [popup, setPopup] = useState<{ results: { name: string; path: string }[]; x: number; y: number } | null>(null)
  const [taskPopup, setTaskPopup] = useState<{
    matches: { project: string; title: string }[]
    taskId: string
    x: number; y: number
  } | null>(null)
  const [folderPopup, setFolderPopup] = useState<{
    matches: { path: string; taskId: string; project: string }[]
    x: number; y: number
  } | null>(null)

  const navigateToTask = useCallback(async (taskId: string, project: string) => {
    const { usePMStore } = await import('@/stores/pm-store.ts')
    await usePMStore.getState().goToTaskTarget(project, taskId)
  }, [])

  const handleCodeClick = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName !== 'CODE' || target.dataset.streamdown !== 'inline-code') return

    const text = target.textContent?.trim() ?? ''
    if (!isClickableCode(text)) return

    e.preventDefault()

    // Session names → navigate to that session
    if (isSessionName(text)) {
      const { sessions } = useSessionStore.getState()
      if (sessions.some(s => s.name === text)) {
        useSessionStore.getState().setActiveSession(text)
      }
      return
    }

    // Task references → multi-project resolution with popup on ambiguity
    const taskId = isTaskRef(text)
    if (taskId) {
      const { sessions, activeSession } = useSessionStore.getState()
      const session = sessions.find(s => s.name === activeSession)
      const sessionProject = session?.task_path?.match(/^projects\/([^/]+)/)?.[1] || null
      const { usePMStore } = await import('@/stores/pm-store.ts')
      const pm = usePMStore.getState()

      // Scratch tasks: resolve project from session context, then fall back to finding
      // a live session that owns this task_id (covers concierge/home-screen context)
      if (taskId.startsWith('scratch/')) {
        let targetProject = sessionProject || pm.activeProject
        if (!targetProject) {
          const { vaultRoot, sessions: allSessions } = useSessionStore.getState()
          const ownerSession = allSessions.find(s => s.task_id === taskId)
          if (ownerSession?.working_dir) {
            const { extractProjectFromWorkingDir } = await import('@/stores/session-store.ts')
            targetProject = extractProjectFromWorkingDir(ownerSession.working_dir, vaultRoot)
          }
          if (!targetProject && pm.availableProjects.length === 1) {
            targetProject = pm.availableProjects[0].id
          }
        }
        if (targetProject) await navigateToTask(taskId, targetProject)
        return
      }

      // Task agent with a known project — navigate directly, no lookup needed
      if (sessionProject) {
        await navigateToTask(taskId, sessionProject)
        return
      }

      // No session project context (e.g. concierge) — try resolving in all available projects concurrently
      const availableProjects = pm.availableProjects
      if (availableProjects.length <= 1) {
        // Only one project — navigate directly (no point checking)
        const targetProject = availableProjects[0]?.id ?? sessionProject ?? pm.activeProject
        if (targetProject) await navigateToTask(taskId, targetProject)
        return
      }

      const resolutions = await Promise.allSettled(
        availableProjects.map(async p => {
          try {
            await resolveTaskPath(p.id, taskId)
            return { project: p.id, title: p.title }
          } catch {
            return null
          }
        })
      )
      const matches = resolutions
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => (r as PromiseFulfilledResult<{ project: string; title: string }>).value!)

      if (matches.length === 0) {
        // Not found in any project — try current context anyway (may still work)
        const targetProject = sessionProject || pm.activeProject
        if (targetProject) await navigateToTask(taskId, targetProject)
        return
      }

      // Prioritize: session project → active PM project → others
      matches.sort((a, b) => {
        const score = (m: typeof a) => {
          if (m.project === sessionProject) return 0
          if (m.project === pm.activeProject) return 1
          return 2
        }
        return score(a) - score(b)
      })

      if (matches.length === 1) {
        await navigateToTask(taskId, matches[0].project)
        return
      }

      // Multiple projects contain this task ID — show picker
      const rect = target.getBoundingClientRect()
      setTaskPopup({ matches, taskId, x: rect.left, y: rect.bottom + 4 })
      return
    }

    // Named folder paths (e.g. "artifacts/", "_system/agents/concierge") — resolve to parent task in PM
    if (isFolderPath(text)) {
      const folderName = text.replace(/\/$/, '')  // strip trailing slash for search/path building
      const { sessions, activeSession } = useSessionStore.getState()
      const session = sessions.find(s => s.name === activeSession)
      const taskDir = session?.task_path
        ? session.task_path.substring(0, session.task_path.lastIndexOf('/'))
        : ''

      const dirExists = async (p: string) => {
        try { return (await fetch(`/api/vault/directory?path=${encodeURIComponent(p)}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })).ok } catch { return false }
      }

      // 1. Try current task's directory first
      if (taskDir) {
        const candidate = `${taskDir}/${folderName}`
        if (await dirExists(candidate)) {
          const tid = isTaskRef(taskDir + '/')
          const proj = taskDir.match(/^projects\/([^/]+)/)?.[1]
          if (tid && proj) { await navigateToTask(tid, proj); return }
        }
      }

      // 2. Search vault for matching directories, keep only task-owned ones
      try {
        const data = await searchVaultDirs(folderName, undefined, 20)
        const taskMatches = (data.results || [])
          .map(r => {
            const tid = isTaskRef(r.path + '/')
            const proj = r.path.match(/^projects\/([^/]+)/)?.[1]
            return tid && proj ? { path: r.path, taskId: tid, project: proj } : null
          })
          .filter((m): m is { path: string; taskId: string; project: string } => m !== null)

        if (taskMatches.length === 0) return
        if (taskMatches.length === 1) { await navigateToTask(taskMatches[0].taskId, taskMatches[0].project); return }

        const rect = target.getBoundingClientRect()
        setFolderPopup({ matches: taskMatches, x: rect.left, y: rect.bottom + 4 })
      } catch {}
      return
    }

    // Normalize absolute paths
    const vr = vaultRoot || '/home/agent/vault'
    const vrPrefix = vr.endsWith('/') ? vr : vr + '/'
    const normalized = text.startsWith(vrPrefix)
      ? text.slice(vrPrefix.length)
      : text

    const { sessions, activeSession } = useSessionStore.getState()
    const session = sessions.find(s => s.name === activeSession)
    const taskDir = session?.task_path
      ? session.task_path.substring(0, session.task_path.lastIndexOf('/'))
      : ''

    // PM-navigable files: navigate PM directly, fall through to search on failure
    const filename = normalized.split('/').pop() || normalized
    const PM_FILES = new Set(['task.md', 'worklog.md'])
    if (PM_FILES.has(filename)) {
      // Try to find the task ID and navigate PM
      const { extractTaskIdFromPath, extractProjectFromPath } = await import('@/lib/paths.ts')

      // Strategy 1: extract from the full path if it has one
      let pmTaskId: string | null = null
      let pmProject: string | null = null
      if (normalized.includes('/')) {
        pmTaskId = extractTaskIdFromPath(normalized)
        pmProject = extractProjectFromPath(normalized)
      }

      // Strategy 2: use the active session's task_id
      if (!pmTaskId && session?.task_id) {
        pmTaskId = session.task_id
        pmProject = session.task_path?.match(/^projects\/([^/]+)/)?.[1] || null
      }

      if (pmTaskId && pmProject) {
        const { usePMStore } = await import('@/stores/pm-store.ts')
        await usePMStore.getState().goToTaskTarget(pmProject, pmTaskId)
        return
      }
      // PM navigation failed — fall through to search below
    }

    // Helper: check if a vault-relative path exists
    const exists = async (p: string) => {
      try {
        const resp = await fetch(`/api/vault/file?path=${encodeURIComponent(p)}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
        return resp.ok
      } catch { return false }
    }

    // 1. Try as-is (vault-relative or absolute-normalized)
    if (await exists(normalized)) {
      openDocTab(normalized, e.ctrlKey || e.metaKey)
      return
    }

    // 2. Try with task_dir prefix from active session
    if (taskDir) {
      const withTaskDir = taskDir + '/' + normalized
      if (await exists(withTaskDir)) {
        openDocTab(withTaskDir, e.ctrlKey || e.metaKey)
        return
      }
    }

    // 3. Try with working_dir prefix
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

    // 4. Search by filename — prioritize matches in current project
    try {
      const data = await searchVaultFiles(filename, undefined, 15)
      const matches = (data.results || []).filter((r: any) =>
        r.name === filename || r.path.endsWith('/' + filename)
      )
      if (matches.length === 0) return // codebase file, do nothing

      // Sort: current task dir first, then current project, then others
      const taskDir = session?.task_path
        ? session.task_path.substring(0, session.task_path.lastIndexOf('/'))
        : ''
      const projectPrefix = session?.task_path?.match(/^(projects\/[^/]+)/)?.[1] || ''
      matches.sort((a: any, b: any) => {
        // Priority: 0 = current task dir, 1 = current project, 2 = other
        const priority = (p: string) => {
          if (taskDir && p.startsWith(taskDir + '/')) return 0
          if (projectPrefix && p.startsWith(projectPrefix + '/')) return 1
          return 2
        }
        const diff = priority(a.path) - priority(b.path)
        if (diff !== 0) return diff
        return a.path.length - b.path.length
      })

      if (matches.length === 1) {
        openDocTab(matches[0].path, e.ctrlKey || e.metaKey)
      } else {
        const rect = target.getBoundingClientRect()
        setPopup({ results: matches.slice(0, 8), x: rect.left, y: rect.bottom + 4 })
      }
    } catch {}
  }, [openDocTab, vaultRoot])

  const closePopup = useCallback(() => setPopup(null), [])
  const closeTaskPopup = useCallback(() => setTaskPopup(null), [])
  const closeFolderPopup = useCallback(() => setFolderPopup(null), [])

  const PopupEl = (
    <>
      {popup && (
        <FileResolvePopup
          results={popup.results}
          x={popup.x}
          y={popup.y}
          onSelect={(path) => { openDocTab(path, false); setPopup(null) }}
          onClose={closePopup}
        />
      )}
      {taskPopup && (
        <TaskResolvePopup
          matches={taskPopup.matches}
          taskId={taskPopup.taskId}
          x={taskPopup.x}
          y={taskPopup.y}
          onSelect={async (project) => {
            setTaskPopup(null)
            await navigateToTask(taskPopup.taskId, project)
          }}
          onClose={closeTaskPopup}
        />
      )}
      {folderPopup && (
        <FileResolvePopup
          results={folderPopup.matches.map(m => ({ name: m.taskId, path: m.path }))}
          x={folderPopup.x}
          y={folderPopup.y}
          onSelect={async (path) => {
            const match = folderPopup.matches.find(m => m.path === path)
            setFolderPopup(null)
            if (match) await navigateToTask(match.taskId, match.project)
          }}
          onClose={closeFolderPopup}
        />
      )}
    </>
  )

  return { handleCodeClick, PopupEl }
}

function useLocalMessageResponseComponents() {
  const openDocTab = useTabStore(s => s.openDocTab)
  const vaultRoot = useSessionStore(s => s.vaultRoot)

  return useMemo(() => ({
    a: ({ href, children, ...props }: any) => {
      const hrefBase = href?.split('#')[0] ?? ''
      const normalized = hrefBase ? normalizeVaultPath(hrefBase, vaultRoot) : ''
      if (href && normalized && isVaultPath(normalized)) {
        return (
          <a
            href="#"
            className="file-link"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault()
              openDocTab(normalized, e.ctrlKey || e.metaKey)
            }}
            {...props}
          >📄 {children}</a>
        )
      }
      return <a href={href} target="_blank" rel="noopener" {...props}>{children}</a>
    },
  }), [openDocTab, vaultRoot])
}

function LocalMessageResponse({
  text,
  className,
  wrapperClassName,
}: {
  text: string
  className?: string
  wrapperClassName?: string
}) {
  const { handleCodeClick, PopupEl } = useFilePathClick()
  const baseComponents = useLocalMessageResponseComponents()
  const components = useMemo(
    () => ({ ...baseComponents, ...chatChipComponents }),
    [baseComponents],
  )

  return (
    <div className={wrapperClassName} onClick={handleCodeClick}>
      <MessageResponse
        className={className}
        components={components}
        remarkPlugins={chatChipRemarkPlugins}
        allowedTags={chatChipAllowedTags}
      >
        {text}
      </MessageResponse>
      {PopupEl}
    </div>
  )
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
      className="fixed z-[100] rounded-lg border border-[var(--color-border-glass)] bg-popover shadow-[var(--shadow-float)] overflow-hidden min-w-[200px] max-w-[400px]"
      style={{ left: Math.min(x, window.innerWidth - 420), top: Math.min(y, window.innerHeight - 200) }}
    >
      <div className="px-2 py-1.5 type-caption text-muted-foreground uppercase tracking-wide border-b border-[var(--color-border)]">
        Multiple matches
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

function TaskResolvePopup({ matches, taskId, x, y, onSelect, onClose }: {
  matches: { project: string; title: string }[]
  taskId: string
  x: number; y: number
  onSelect: (project: string) => void
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
      className="fixed z-[100] rounded-lg border border-[var(--color-border-glass)] bg-popover shadow-[var(--shadow-float)] overflow-hidden min-w-[200px] max-w-[360px]"
      style={{ left: Math.min(x, window.innerWidth - 380), top: Math.min(y, window.innerHeight - 200) }}
    >
      <div className="px-2 py-1.5 type-caption text-muted-foreground uppercase tracking-wide border-b border-[var(--color-border)]">
        Open in project
      </div>
      {matches.map((m) => (
        <div
          key={m.project}
          className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-[var(--bg-ingrained)] transition-colors"
          onClick={() => onSelect(m.project)}
        >
          <Bot size={12} className="text-muted-foreground shrink-0" />
          <span className="text-foreground font-medium shrink-0">{m.title}</span>
          <span className="text-muted-foreground truncate">/ {taskId}</span>
        </div>
      ))}
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Assistant message
// ---------------------------------------------------------------------------

function AssistantMessage({ message }: { message: Message }) {
  return (
    <div
      data-msg-uuid={message.uuid}
      className="group/msg self-start max-w-[90%] min-w-0 animate-fade-in relative"
    >
      <div className="float-right flex gap-1 -mt-0.5 -mr-1 ml-2 mb-1 opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 transition-opacity duration-200">
      </div>
      {message.content.map((block, i) => {
        if (block.type === 'text') {
          return (
            <LocalMessageResponse key={i} text={block.text} wrapperClassName="text-sm leading-relaxed" />
          )
        }
        return null
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool group — collapsible section for consecutive tool_use + tool_result blocks
// ---------------------------------------------------------------------------

function ToolGroup({ items }: { items: ToolGroupItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const vaultRoot = useSessionStore(s => s.vaultRoot)
  const openDocTab = useTabStore(s => s.openDocTab)

  const toolNames: string[] = []
  let toolCount = 0
  for (const item of items) {
    if (item.kind === 'block' && item.block.type === 'tool_use') {
      toolCount++
      const name = (item.block as ToolUseBlock).name
      if (!toolNames.includes(name)) toolNames.push(name)
    }
  }
  if (toolCount === 0) toolCount = items.length

  const label = `${toolCount} tool${toolCount !== 1 ? 's' : ''}` +
    (toolNames.length > 0 ? ` \u2014 ${toolNames.join(', ')}` : '')

  // Collect image paths from tool results to render outside the indented section
  const inlineImages = useMemo(() => {
    const paths: string[] = []
    for (const item of items) {
      if (item.kind !== 'block' || item.block.type !== 'tool_result') continue
      const block = item.block as ToolResultBlock
      const raw = typeof block.content === 'string' ? block.content
        : Array.isArray(block.content) ? (block.content as any[]).filter(b => b?.type === 'text').map(b => b.text).join('\n')
        : JSON.stringify(block.content)
      const checkObj = (obj: any) => {
        const c = obj?.saved_to || obj?.path || obj?.image_path || obj?.file_path
        if (typeof c === 'string' && IMAGE_EXTENSIONS.has(c.slice(c.lastIndexOf('.')).toLowerCase())) return c
        return null
      }
      try {
        const parsed = JSON.parse(raw)
        const hit = checkObj(parsed) ?? (typeof parsed?.result === 'string' ? (() => { try { return checkObj(JSON.parse(parsed.result)) } catch { return null } })() : null)
        if (hit) paths.push(hit)
      } catch {}
    }
    return paths
  }, [items])

  return (
    <div className="my-1">
      <div
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer text-xs text-muted-foreground py-1.5 select-none transition-colors duration-200 hover:text-foreground"
      >
        <ChevronRight size={10} className={`inline-block transition-transform duration-200 text-muted-foreground shrink-0 mr-1.5 ${expanded ? 'rotate-90' : ''}`} />
        {label}
      </div>
      {inlineImages.map((imgPath, i) => {
        const rel = normalizeVaultPath(imgPath, vaultRoot)
        return (
          <div
            key={i}
            className="cursor-pointer rounded-md overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors inline-block mt-1 mb-1 mr-2"
            onClick={() => openDocTab(rel, false)}
            title={imgPath}
          >
            <img src={vaultPreviewUrl(rel)} alt={imgPath.split('/').pop()} className="block max-h-72 max-w-full object-contain" />
          </div>
        )
      })}
      {expanded && (
        <div className="pl-4">
          {items.map((item, j) => {
            if (item.kind === 'system') return <SystemCard key={j} message={item.message} />
            const block = item.block
            if (block.type === 'tool_use') return <ToolCard key={j} block={block as ToolUseBlock} />
            if (block.type === 'tool_result') return <ToolResultCard key={j} block={block as ToolResultBlock} />
            return null
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thinking block (item #3 — pulsing animation, better UX)
// ---------------------------------------------------------------------------

function ThinkingBlock({ block }: { block: ThinkingBlockType }) {
  const [expanded, setExpanded] = useState(false)
  const preview = block.thinking.substring(0, 120).replace(/\n/g, ' ')

  return (
    <CollapsibleCard variant="thinking">
      <CollapsibleCardHeader className="type-micro text-muted-foreground gap-1.5" onClick={() => setExpanded(!expanded)}>
        <ChevronRight size={10} className={`transition-transform duration-200 shrink-0 text-muted-foreground ${expanded ? 'rotate-90' : ''}`} />
        <span className="font-medium text-muted-foreground">Thinking</span>
        {!expanded && (
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap italic type-micro text-muted-foreground opacity-60">
            {preview}{block.thinking.length > 120 ? '...' : ''}
          </span>
        )}
      </CollapsibleCardHeader>
      {expanded && (
        <CollapsibleCardBody className="border-dashed p-2.5 text-xs text-muted-foreground leading-relaxed break-words max-h-[300px] overflow-y-auto">
          <LocalMessageResponse text={block.thinking} />
        </CollapsibleCardBody>
      )}
    </CollapsibleCard>
  )
}

// ---------------------------------------------------------------------------
// Tool card (item #2 — status badges, better formatting, copy)
// ---------------------------------------------------------------------------

function getToolIcon(name: string) {
  const n = name.toLowerCase()
  if (n === 'read') return <Eye size={12} />
  if (n === 'write' || n === 'edit') return <Pencil size={12} />
  if (n === 'bash') return <Terminal size={12} />
  if (n === 'glob') return <FileText size={12} />
  if (n === 'grep') return <Search size={12} />
  if (n === 'webfetch' || n === 'websearch') return <Globe size={12} />
  return <Wrench size={12} />
}

function WriteToolContent({ filePath, content }: { filePath: string; content: string | null }) {
  const [showContent, setShowContent] = useState(false)
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground">{filePath}</div>
      {content && (
        <div>
          <div
            onClick={(e) => { e.stopPropagation(); setShowContent(!showContent) }}
            className="cursor-pointer type-micro text-muted-foreground py-0.5 select-none transition-colors duration-200 hover:text-foreground"
          >
            <ChevronRight size={10} className={`inline-block transition-transform duration-200 shrink-0 mr-1 ${showContent ? 'rotate-90' : ''}`} />
            Content ({content.split('\n').length} lines)
          </div>
          {showContent && (
            <div className="mt-1 pl-2 border-l border-[var(--color-border-subtle)] max-h-[400px] overflow-y-auto">
              <LocalMessageResponse text={content} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Format tool input as clean key-value pairs with smart rendering per type. */
function FormatToolInput({ name, input }: { name: string; input: Record<string, unknown> }) {
  const n = name.toLowerCase()

  // Edit: show diff
  if (n === 'edit' && input.file_path) {
    return (
      <div className="space-y-1">
        <div className="text-muted-foreground">{String(input.file_path)}</div>
        {input.old_string ? (
          <pre className="m-0 text-[var(--color-red)] opacity-80">- {String(input.old_string)}</pre>
        ) : null}
        {input.new_string ? (
          <pre className="m-0 text-[var(--color-green)] opacity-80">+ {String(input.new_string)}</pre>
        ) : null}
      </div>
    )
  }

  // Bash: show as command
  if (n === 'bash' && input.command) {
    return (
      <div className="space-y-1">
        <pre className="m-0">$ {String(input.command)}</pre>
        {input.description ? <div className="text-muted-foreground italic">{String(input.description)}</div> : null}
      </div>
    )
  }

  // Write: path + expandable content
  if (n === 'write' && input.file_path) {
    return <WriteToolContent filePath={String(input.file_path)} content={input.content ? String(input.content) : null} />
  }

  // Read: just the path
  if (n === 'read' && input.file_path) {
    const parts = [String(input.file_path)]
    if (input.offset) parts.push(`offset: ${input.offset}`)
    if (input.limit) parts.push(`limit: ${input.limit}`)
    return <div>{parts.join('  ')}</div>
  }

  // Generic: render all key-value pairs cleanly
  const entries = Object.entries(input).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return (
    <div className="space-y-1.5">
      {entries.map(([key, val]) => {
        const strVal = typeof val === 'string' ? val : JSON.stringify(val, null, 2)
        const isLong = strVal.length > 100 || strVal.includes('\n')
        return (
          <div key={key}>
            <span className="text-muted-foreground">{key}:</span>
            {isLong ? (
              <div className="mt-0.5 pl-2 border-l border-[var(--color-border-subtle)]">
                <LocalMessageResponse text={strVal} />
              </div>
            ) : (
              <span className="ml-1.5">{strVal}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ToolCard({ block }: { block: ToolUseBlock }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const preview = formatToolPreview(block.name, block.input)

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(JSON.stringify(block.input, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [block.input])

  return (
    <CollapsibleCard variant="tool">
      <CollapsibleCardHeader className="text-xs gap-1.5" onClick={() => setExpanded(!expanded)}>
        <span className="shrink-0 text-muted-foreground flex items-center">{getToolIcon(block.name)}</span>
        <span className="font-mono font-semibold text-[var(--color-orange)] shrink-0">{block.name}</span>
        <span className="text-muted-foreground type-micro overflow-hidden text-ellipsis whitespace-nowrap flex-1">{preview}</span>
        <span className="type-caption font-medium px-1.5 py-px rounded-[10px] uppercase tracking-wide shrink-0 bg-[rgba(212,146,42,0.15)] text-[var(--color-orange)]">Running</span>
        <ChevronRight size={12} className={`transition-transform duration-200 shrink-0 text-muted-foreground ${expanded ? 'rotate-90' : ''}`} />
      </CollapsibleCardHeader>
      {expanded && (
        <CollapsibleCardBody className="p-2.5 text-xs leading-snug max-h-[300px] overflow-y-auto break-words text-muted-foreground relative">
          <IconButton variant="copy" size="copy" className="absolute right-1.5 top-1.5 z-10" onClick={handleCopy} title="Copy input">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </IconButton>
          <FormatToolInput name={block.name} input={block.input} />
        </CollapsibleCardBody>
      )}
    </CollapsibleCard>
  )
}

function ToolResultCard({ block }: { block: ToolResultBlock }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const rawContent = typeof block.content === 'string'
    ? block.content
    : Array.isArray(block.content)
      ? (block.content as any[]).filter(b => b?.type === 'text').map(b => b.text).join('\n') || JSON.stringify(block.content)
      : JSON.stringify(block.content)
  const preview = rawContent.substring(0, 100).replace(/\n/g, ' ')
  const isError = block.is_error === true

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(rawContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [rawContent])

  return (
    <>
      <CollapsibleCard variant={isError ? 'result-error' : 'result'}>
      <CollapsibleCardHeader className="type-micro text-muted-foreground gap-1.5" onClick={() => setExpanded(!expanded)}>
        <ChevronRight size={10} className={`transition-transform duration-200 shrink-0 text-muted-foreground ${expanded ? 'rotate-90' : ''}`} />
        <span className={`type-caption font-medium px-1.5 py-px rounded-[10px] uppercase tracking-wide shrink-0 ${isError ? 'bg-[rgba(224,90,75,0.15)] text-[var(--color-red)]' : 'bg-[rgba(59,184,122,0.15)] text-[var(--color-green)]'}`}>
          {isError ? 'Error' : 'Result'}
        </span>
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono type-micro">
          {preview}{rawContent.length > 100 ? '...' : ''}
        </span>
      </CollapsibleCardHeader>
      {expanded && (
        <CollapsibleCardBody className="p-2.5 text-xs leading-snug max-h-[400px] overflow-y-auto break-words text-muted-foreground relative">
          <IconButton variant="copy" size="copy" className="absolute right-1.5 top-1.5" onClick={handleCopy} title="Copy output">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </IconButton>
          <div className="text-xs">
            <LocalMessageResponse text={rawContent} />
          </div>
        </CollapsibleCardBody>
      )}
    </CollapsibleCard>
    </>
  )
}

// ---------------------------------------------------------------------------
// System card — renders hook/local-command/task-notification meta messages
// ---------------------------------------------------------------------------

const SUBTYPE_CONFIG: Record<MessageSubtype, { icon: React.ReactNode; label: string; variant: string }> = {
  hook:              { icon: <Link2 size={12} />,       label: 'Hook',        variant: 'system' },
  local_command:     { icon: <Terminal size={12} />,     label: 'Command',     variant: 'system' },
  task_notification: { icon: <Zap size={12} />,          label: 'Task',        variant: 'system' },
  system_prompt:     { icon: <FileText size={12} />,     label: 'Prompt',      variant: 'system' },
  agent_message:     { icon: <Bot size={12} />,          label: 'Agent',       variant: 'system' },
  interrupt:         { icon: <Ban size={12} />,          label: 'Interrupted', variant: 'system' },
}

function getSystemCardPreview(subtype: MessageSubtype, text: string): string {
  if (subtype === 'hook') {
    // "Stop hook feedback:\n[System] Your Claude session ID is: ..." → extract the payload
    const lines = text.split('\n').filter(l => l.trim())
    // Skip the "Stop hook feedback:" / "Stop hook blocking error from command:" prefix
    const payload = lines.find(l => !l.startsWith('Stop hook')) || lines[0] || ''
    return payload.substring(0, 100)
  }
  if (subtype === 'local_command') {
    // Extract content from XML tags — 3 message types:
    // 1. <local-command-caveat>...</local-command-caveat>
    // 2. <command-name>...</command-name>
    // 3. <local-command-stdout>...</local-command-stdout>
    const cmdName = text.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1]?.trim()
    if (cmdName) return cmdName
    const stdout = text.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/)?.[1]?.trim()
    if (stdout) return stdout.replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0].substring(0, 100)
    const caveat = text.match(/<local-command-caveat>([\s\S]*?)<\/local-command-caveat>/)?.[1]?.trim()
    if (caveat) return caveat.substring(0, 100)
    return text.substring(0, 100)
  }
  if (subtype === 'task_notification') {
    const summary = text.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim()
    const status = text.match(/<status>([\s\S]*?)<\/status>/)?.[1]?.trim()
    if (summary) return `${status === 'completed' ? 'Done' : status || '?'}: ${summary}`
    return text.substring(0, 100)
  }
  if (subtype === 'system_prompt') {
    // Extract session name from "[System] Your tmux session name is: task_XXXXXXXX"
    const sessionMatch = text.match(/session name is:\s*(\S+)/)
    return sessionMatch ? `Session: ${sessionMatch[1]}` : 'System prompt'
  }
  if (subtype === 'interrupt') {
    return 'Request interrupted by user'
  }
  if (subtype === 'agent_message') {
    // "[Source: agent:chainlink_xxx | role:chainlink | ...]\nBriefing updated..."
    const roleMatch = text.match(/role:(\S+)/)
    const role = roleMatch ? roleMatch[1].replace(/\|/g, '').trim() : 'agent'
    // Get the first line of actual content (after the [Source:...] header)
    const bodyStart = text.indexOf(']\n')
    const body = bodyStart >= 0 ? text.substring(bodyStart + 2).trim().split('\n')[0] : ''
    return body ? `${role}: ${body.substring(0, 80)}` : role
  }
  return text.substring(0, 100)
}

/** Subtypes that should render expanded by default. */
const EXPANDED_BY_DEFAULT = new Set<string>(['agent_message'])

function SystemCard({ message }: { message: Message }) {
  const subtype = message.subtype || 'hook'
  const [expanded, setExpanded] = useState(EXPANDED_BY_DEFAULT.has(subtype))
  // system_prompt cards (SessionStart hook scaffolding etc.) carry no UX value
  // for the user — hidden permanently.
  if (subtype === 'system_prompt') return null
  const config = SUBTYPE_CONFIG[subtype] || SUBTYPE_CONFIG.hook
  const text = message.content
    ?.filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('\n') || ''
  const preview = getSystemCardPreview(subtype, text)

  // Task notifications: show success/error variant
  const isTaskNotif = subtype === 'task_notification'
  const taskStatus = isTaskNotif ? text.match(/<status>([\s\S]*?)<\/status>/)?.[1]?.trim() : null
  const taskOk = taskStatus === 'completed'
  const variant = isTaskNotif ? (taskOk ? 'system-success' : 'system-error') : config.variant

  return (
    <CollapsibleCard variant={variant as any}>
      <CollapsibleCardHeader className="type-micro text-muted-foreground gap-1.5" onClick={() => setExpanded(!expanded)}>
        <span className="shrink-0 flex items-center text-muted-foreground">{config.icon}</span>
        <span className="type-caption font-medium px-1.5 py-px rounded-[10px] uppercase tracking-wide shrink-0 bg-[rgba(130,130,160,0.12)] text-muted-foreground">
          {config.label}
        </span>
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap type-micro">
          {preview}
        </span>
        <ChevronRight size={10} className={`transition-transform duration-200 shrink-0 text-muted-foreground ${expanded ? 'rotate-90' : ''}`} />
      </CollapsibleCardHeader>
      {expanded && (
        <CollapsibleCardBody className="p-2.5 type-micro leading-relaxed bg-[var(--bg-base)] text-muted-foreground max-h-[300px] overflow-y-auto break-words">
          <div className="text-xs">
            <LocalMessageResponse text={subtype === 'agent_message' ? text.replace(/^\[Source:[^\]]*\]\n?/, '') : text} />
          </div>
        </CollapsibleCardBody>
      )}
    </CollapsibleCard>
  )
}

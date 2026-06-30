import { useState, useRef, useEffect } from 'react'
import type { NodeDetail, DoneWhenItem } from '@/stores/pm-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { SpawnSessionButton } from './shared.tsx'
import { ActiveAgents } from '@/components/home/ActiveAgents.tsx'
import { PastAgents } from '@/components/home/PastAgents.tsx'
import { AppIcon, PMBadge, SegmentedControl, type AppIconName } from '@/components/primitives'
import { MarkdownPreview } from './MarkdownPreview.tsx'
import { InlineMarkdownEditor } from './InlineMarkdownEditor.tsx'
import { FileColumn } from './FileColumn.tsx'
import { PlanTab } from './PlanTab.tsx'
import { LogTab } from './LogTab.tsx'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu.tsx'
import * as api from '@/lib/api.ts'
import { displayPMNodeId } from '@/lib/paths.ts'

const HIDDEN_AGENT_ROLES = new Set(['chainlink', 'verifier', 'shadow'])

function segmentIcon(name: AppIconName) {
  return function SegmentAppIcon({ size, className }: { size?: number; className?: string }) {
    return <AppIcon name={name} size={size} className={className} />
  }
}

function isVisibleLiveAgentSession(session: { status?: string; agent_role?: string | null }) {
  return session.status !== 'dead'
    && session.status !== 'ended'
    && !(session.agent_role && HIDDEN_AGENT_ROLES.has(session.agent_role))
}

// --- Agents panel (embedded ActiveAgents + PastAgents, filtered to node subtree) ---

function NodeAgentsPanel({ nodePath, nodeId }: { nodePath?: string; nodeId?: string }) {
  const vaultRoot = useSessionStore(s => s.vaultRoot)
  const activeProject = usePMStore(s => s.activeProject)
  const rel = nodePath ?? ''
  const abs = rel && vaultRoot ? `${vaultRoot.replace(/\/$/, '')}/${rel}` : ''
  const tid = nodeId ?? ''
  const projectRoot = activeProject && vaultRoot ? `${vaultRoot.replace(/\/$/, '')}/projects/${activeProject}/` : ''
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <SpawnSessionButton
          taskPath={rel}
          small
          onSpawned={() => usePMStore.getState().refreshCurrentNode()}
        />
      </div>
      <ActiveAgents
        readOnly
        compactMode
        suppressGroupHeaders
        filter={(sess) => {
          if (tid && sess.task_id && (sess.task_id === tid || sess.task_id.startsWith(tid + '.'))) {
            if (rel && sess.task_path?.startsWith(rel + '/')) return true
            if (rel && sess.task_path === `${rel}/task.md`) return true
            if (projectRoot && sess.working_dir?.startsWith(projectRoot)) return true
          }
          if (!sess.working_dir) return false
          if (rel && sess.working_dir.startsWith(rel)) return true
          if (abs && sess.working_dir.startsWith(abs)) return true
          return false
        }}
        emptyState={null}
      />
      <PastAgents
        projectId={activeProject ?? undefined}
        defaultDays={365}
        compactMode
        suppressDayGrouping
        workingDirPrefixes={rel ? [rel] : undefined}
        taskIdPrefixes={tid ? [tid] : undefined}
        emptyState={
          <div className="type-micro text-muted-foreground italic py-2 text-center">
            No past agents for this task.
          </div>
        }
      />
    </div>
  )
}

// --- Collapsible section wrapper ---
function Section({ label, defaultOpen = true, count, children }: { label: string; defaultOpen?: boolean; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        className="flex items-center gap-1 bg-transparent border-none text-xs font-semibold text-muted-foreground cursor-pointer py-0.5 px-0 hover:text-foreground transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
      >
        <AppIcon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
        {label}{count != null ? ` (${count})` : ''}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo', icon: 'task', color: 'text-muted-foreground' },
  { value: 'propose', label: 'Propose', icon: 'sparkles', color: 'text-orange' },
  { value: 'executing', label: 'Executing', icon: 'refresh', color: 'text-accent' },
  { value: 'conversation', label: 'Conversation', icon: 'chat', color: 'text-orange' },
  { value: 'blocked', label: 'Blocked', icon: 'lock', color: 'text-red' },
  { value: 'done', label: 'Done', icon: 'check', color: 'text-green' },
  { value: 'shelved', label: 'Shelved', icon: 'archive', color: 'text-muted-foreground' },
  { value: 'dropped', label: 'Dropped', icon: 'x', color: 'text-muted-foreground' },
] as const

const STATUS_BADGE_COLORS: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  done: 'green',
  active: 'green',
  executing: 'green',
  propose: 'amber',
  conversation: 'amber',
  todo: 'gray',
  blocked: 'red',
  shelved: 'gray',
  dropped: 'gray',
}

function StatusDropdown({ status, taskId }: { status: string; taskId: string }) {
  const updateTaskFields = usePMStore(s => s.updateTaskFields)

  const handleSelect = async (newStatus: string) => {
    if (newStatus === status) return
    await updateTaskFields(taskId, { status: newStatus })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <PMBadge
          variant={STATUS_BADGE_COLORS[status] || 'gray'}
          editable
          className="shrink-0"
          role="button"
          onClick={(e) => e.stopPropagation()}
        >
          {status} ▾
        </PMBadge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Set status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUS_OPTIONS.slice(0, 5).map(opt => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => handleSelect(opt.value)}
          >
            <AppIcon name={opt.icon} size={14} className={opt.color} />
            {opt.label}
            {status === opt.value && <AppIcon name="check" size={14} className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {STATUS_OPTIONS.slice(5).map(opt => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => handleSelect(opt.value)}
          >
            <AppIcon name={opt.icon} size={14} className={opt.color} />
            {opt.label}
            {status === opt.value && <AppIcon name="check" size={14} className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


// --- Title editor ---
function TitleEditor({ title, taskId, displayId }: { title: string; taskId: string; displayId: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateTaskFields = usePMStore(s => s.updateTaskFields)
  const showDisplayId = /^\d+(?:\.\d+)*$/.test(displayId)

  useEffect(() => { setValue(title) }, [title])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const save = async () => {
    const trimmed = value.trim()
    setEditing(false)
    if (trimmed && trimmed !== title) {
      const project = usePMStore.getState().activeProject
      if (project) {
        try {
          await api.renameTask(project, taskId, trimmed)
          // Clear current project's cache and refresh — folder/file paths changed
          usePMStore.setState(s => {
            const next = { ...s.nodeCache }
            delete next[project]
            return { nodeCache: next }
          })
          usePMStore.getState().refreshCurrentNode()
        } catch {
          // Fallback: just update YAML title if rename endpoint fails
          await updateTaskFields(taskId, { title: trimmed })
        }
      }
    } else {
      setValue(title)
    }
  }

  if (!editing) {
    return (
      <h2
        className="text-base font-semibold m-0 cursor-pointer group/title flex items-center gap-1.5"
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        title="Click to edit title"
      >
        {showDisplayId && <span className="text-muted-foreground type-micro">{displayId}</span>}
        {title}
        <AppIcon name="edit" size={12} className="text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
      </h2>
    )
  }

  return (
    <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
      {showDisplayId && <span className="text-muted-foreground type-micro">{displayId}</span>}
      <input
        ref={inputRef}
        autoFocus
        className="flex-1 text-base font-semibold px-1.5 py-0.5 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] text-foreground outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          else if (e.key === 'Escape') { setValue(title); setEditing(false) }
        }}
        onBlur={save}
      />
    </div>
  )
}

// --- Desc editor ---
function DescEditor({ desc, taskId }: { desc: string; taskId: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(desc)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const updateTaskFields = usePMStore(s => s.updateTaskFields)

  useEffect(() => { setValue(desc) }, [desc])
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.select()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [editing])

  const save = async () => {
    const trimmed = value.trim()
    setEditing(false)
    if (trimmed !== desc) {
      await updateTaskFields(taskId, { desc: trimmed })
    } else {
      setValue(desc)
    }
  }

  if (!editing) {
    return (
      <div
        className="text-muted-foreground type-body-sm leading-relaxed m-0 cursor-pointer group/desc"
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        title="Click to edit description"
      >
        <span>{desc || '(no description)'}</span>
        <AppIcon name="edit" size={11} className="inline ml-1.5 text-muted-foreground opacity-0 group-hover/desc:opacity-100 transition-opacity" />
      </div>
    )
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <textarea
        ref={textareaRef}
        autoFocus
        className="w-full type-body-sm leading-relaxed px-1.5 py-1 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] text-foreground outline-none resize-none"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
          else if (e.key === 'Escape') { setValue(desc); setEditing(false) }
        }}
        onBlur={save}
      />
      <div className="type-caption text-muted-foreground mt-0.5">Ctrl+Enter to save, Escape to cancel</div>
    </div>
  )
}

// --- Owner editor ---
// Exported but not currently mounted in NodeHeader (header chips stripped 2026-05-17).
// Retained here for future re-introduction in a different surface.
export function OwnerEditor({ owner, taskId }: { owner?: string | string[]; taskId: string }) {
  const [editing, setEditing] = useState(false)
  const updateTaskFields = usePMStore(s => s.updateTaskFields)

  const ownerList = Array.isArray(owner) ? owner : owner ? [owner] : []
  const displayText = ownerList.join(', ') || '(none)'

  const [value, setValue] = useState(displayText)
  useEffect(() => { setValue(ownerList.join(', ') || '') }, [owner])

  const save = async () => {
    setEditing(false)
    const parsed = value.split(',').map(s => s.trim()).filter(Boolean)
    const currentStr = ownerList.join(', ')
    const newStr = parsed.join(', ')
    if (newStr !== currentStr) {
      await updateTaskFields(taskId, { owner: parsed })
    }
  }

  if (!editing) {
    return (
      <PMBadge
        variant="gray"
        editable
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        title="Click to edit owner"
      >
        <AppIcon name="agent" size={11} /> {displayText}
      </PMBadge>
    )
  }

  return (
    <span className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        className="type-micro px-1.5 py-0.5 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] text-foreground outline-none w-[140px]"
        placeholder="user, agent"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          else if (e.key === 'Escape') { setValue(ownerList.join(', ') || ''); setEditing(false) }
        }}
        onBlur={save}
      />
    </span>
  )
}

// --- Done When editor ---
function DoneWhenEditor({ items, taskId }: { items?: DoneWhenItem[]; taskId: string }) {
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const updateTaskFields = usePMStore(s => s.updateTaskFields)
  const doneWhen = items || []
  const doneCount = doneWhen.filter(d => d.done).length
  const totalCount = doneWhen.length

  const toggle = async (index: number) => {
    const updated = doneWhen.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    )
    await updateTaskFields(taskId, { done_when: updated })
  }

  const remove = async (index: number) => {
    const updated = doneWhen.filter((_, i) => i !== index)
    await updateTaskFields(taskId, { done_when: updated })
  }

  const add = async () => {
    const text = newText.trim()
    if (!text) { setAdding(false); return }
    const updated = [...doneWhen, { text, done: false }]
    setNewText('')
    setAdding(false)
    await updateTaskFields(taskId, { done_when: updated })
  }

  if (totalCount === 0 && !adding) {
    return (
      <div className="flex items-center gap-1">
        <button
          className="inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground transition-all duration-150 hover:border-[var(--color-accent)] hover:text-accent-foreground"
          onClick={(e) => { e.stopPropagation(); setAdding(true) }}
        >
          <AppIcon name="plus" size={10} /> Add done-when criteria
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 type-body-sm">
      <div className="font-semibold text-xs text-muted-foreground mb-0.5">Done when ({doneCount}/{totalCount}):</div>
      {doneWhen.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 group/dw">
          <button
            className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center shrink-0"
            onClick={(e) => { e.stopPropagation(); toggle(i) }}
            title={item.done ? 'Mark incomplete' : 'Mark complete'}
          >
            {item.done
              ? <AppIcon name="check" size={13} className="text-green" />
              : <AppIcon name="task" size={13} className="text-muted-foreground hover:text-accent" />}
          </button>
          <span className={`flex-1 min-w-0 ${item.done ? 'text-muted-foreground line-through' : ''}`}>
            <MarkdownPreview value={item.text} inline />
          </span>
          <button
            className="bg-transparent border-none p-0 cursor-pointer text-muted-foreground inline-flex items-center opacity-0 group-hover/dw:opacity-100 transition-opacity hover:text-red shrink-0"
            onClick={(e) => { e.stopPropagation(); remove(i) }}
            title="Remove criterion"
          >
            <AppIcon name="x" size={12} />
          </button>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <AppIcon name="task" size={13} className="text-muted-foreground shrink-0" />
          <input
            autoFocus
            className="flex-1 type-body-sm px-1.5 py-0.5 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] text-foreground outline-none"
            placeholder="New criterion..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
              else if (e.key === 'Escape') { setNewText(''); setAdding(false) }
            }}
            onBlur={add}
          />
        </div>
      ) : (
        <button
          className="inline-flex items-center gap-[3px] px-1 py-px rounded border border-[var(--color-border-subtle)] bg-transparent type-caption cursor-pointer text-muted-foreground transition-all duration-150 hover:border-[var(--color-accent)] hover:text-accent-foreground self-start"
          onClick={(e) => { e.stopPropagation(); setAdding(true) }}
        >
          <AppIcon name="plus" size={10} /> Add criterion
        </button>
      )}
    </div>
  )
}

// --- Goal dropdown ---
// Exported but not currently mounted in NodeHeader (header chips stripped 2026-05-17).
// Retained here for future re-introduction in a different surface.
export function GoalEditor({ currentGoal, taskId }: { currentGoal?: string; taskId: string }) {
  const state = usePMStore(s => s.state)
  const updateTaskFields = usePMStore(s => s.updateTaskFields)

  // Collect available sub-goal IDs from state
  const goalOptions: string[] = []
  if (state?.goals) {
    for (const g of state.goals) {
      if (g.sub) {
        for (const s of g.sub) {
          goalOptions.push(s.id)
        }
      }
    }
  }

  const handleSelect = async (goalId: string) => {
    const newGoal = goalId === '__none__' ? null : goalId
    await updateTaskFields(taskId, { goal: newGoal })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <PMBadge
          variant="goal"
          editable
          role="button"
          onClick={(e) => e.stopPropagation()}
          title="Click to change goal"
        >
          🎯 {currentGoal || '(none)'} ▾
        </PMBadge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Set goal</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleSelect('__none__')}>
          (none)
          {!currentGoal && <AppIcon name="check" size={14} className="ml-auto" />}
        </DropdownMenuItem>
        {goalOptions.map(g => (
          <DropdownMenuItem key={g} onSelect={() => handleSelect(g)}>
            {g}
            {currentGoal === g && <AppIcon name="check" size={14} className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// --- Deps editor ---
function DepsEditor({ currentDeps, taskId }: { currentDeps?: string[]; taskId: string }) {
  const [adding, setAdding] = useState(false)
  const updateTaskFields = usePMStore(s => s.updateTaskFields)
  const deps = currentDeps || []

  const handleRemove = async (dep: string) => {
    const newDeps = deps.filter(d => d !== dep)
    await updateTaskFields(taskId, { deps: newDeps })
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {deps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {deps.map(dep => (
            <PMBadge key={dep} variant="dep">
              {dep.split('/').pop()}
              <button
                className="bg-transparent border-none p-0 cursor-pointer text-muted-foreground inline-flex items-center hover:text-red"
                onClick={(e) => { e.stopPropagation(); handleRemove(dep) }}
                title="Remove dependency"
              >
                <AppIcon name="x" size={10} />
              </button>
            </PMBadge>
          ))}
        </div>
      )}
      {adding ? (
        <input
          autoFocus
          className="type-micro px-1.5 py-0.5 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] text-foreground outline-none w-[100px]"
          placeholder="Task ID (e.g. 1.2.3)"
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim()
              if (val) {
                await updateTaskFields(taskId, { deps: [...deps, val] })
              }
              setAdding(false)
            } else if (e.key === 'Escape') {
              setAdding(false)
            }
          }}
          onBlur={() => setAdding(false)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          className="inline-flex items-center gap-[3px] px-1 py-px rounded border border-[var(--color-border-subtle)] bg-transparent type-caption cursor-pointer text-muted-foreground transition-all duration-150 hover:border-[var(--color-accent)] hover:text-accent-foreground"
          onClick={(e) => { e.stopPropagation(); setAdding(true) }}
        >
          + dep
        </button>
      )}
    </div>
  )
}

// --- String list editor (for open_questions, priorities, context.background, context.decisions, context.references) ---
// Some legacy task.md files store items as {date, text} objects — coerce to string for display.
function coerceItem(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>
    const text = typeof o.text === 'string' ? o.text : typeof o.note === 'string' ? o.note : typeof o.decision === 'string' ? o.decision : ''
    const date = typeof o.date === 'string' ? o.date : ''
    return date && text ? `${date}: ${text}` : text || JSON.stringify(item)
  }
  return String(item ?? '')
}
function StringListEditor({ items: rawItems, label, placeholder, onSave }: { items: unknown[]; label: string; placeholder: string; onSave: (items: string[]) => void }) {
  const items = (rawItems || []).map(coerceItem)
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const remove = (index: number) => {
    onSave(items.filter((_, i) => i !== index))
  }

  const add = () => {
    const text = newText.trim()
    if (!text) { setAdding(false); return }
    onSave([...items, text])
    setNewText('')
    setAdding(false)
  }

  const saveEdit = (index: number) => {
    const text = editValue.trim()
    setEditIndex(null)
    if (!text) { remove(index); return }
    if (text !== items[index]) {
      onSave(items.map((item, i) => i === index ? text : item))
    }
  }

  return (
    <div className="flex flex-col gap-1 type-body-sm">
      <div className="font-semibold text-xs text-muted-foreground mb-0.5">{label}</div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5 group/sli">
          <span className="text-muted-foreground type-micro mt-0.5 shrink-0">•</span>
          {editIndex === i ? (
            <input
              autoFocus
              className="flex-1 type-body-sm px-1.5 py-0.5 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] text-foreground outline-none"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(i)
                else if (e.key === 'Escape') setEditIndex(null)
              }}
              onBlur={() => saveEdit(i)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="flex-1 min-w-0 cursor-pointer hover:text-accent transition-colors"
              onClick={(e) => { e.stopPropagation(); setEditIndex(i); setEditValue(item) }}
            >
              {item}
            </span>
          )}
          <button
            className="bg-transparent border-none p-0 cursor-pointer text-muted-foreground inline-flex items-center opacity-0 group-hover/sli:opacity-100 transition-opacity hover:text-red shrink-0 mt-0.5"
            onClick={(e) => { e.stopPropagation(); remove(i) }}
            title="Remove"
          >
            <AppIcon name="x" size={12} />
          </button>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <span className="text-muted-foreground type-micro shrink-0">•</span>
          <input
            autoFocus
            className="flex-1 type-body-sm px-1.5 py-0.5 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] text-foreground outline-none"
            placeholder={placeholder}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
              else if (e.key === 'Escape') { setNewText(''); setAdding(false) }
            }}
            onBlur={add}
          />
        </div>
      ) : (
        <button
          className="inline-flex items-center gap-[3px] px-1 py-px rounded border border-[var(--color-border-subtle)] bg-transparent type-caption cursor-pointer text-muted-foreground transition-all duration-150 hover:border-[var(--color-accent)] hover:text-accent-foreground self-start"
          onClick={(e) => { e.stopPropagation(); setAdding(true) }}
        >
          <AppIcon name="plus" size={10} /> Add
        </button>
      )}
    </div>
  )
}

// --- Single-line editor (for focus, horizon) ---
function InlineFieldEditor({ value, label, taskId, field }: { value: string; label: string; taskId: string; field: 'focus' | 'horizon' }) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const updateTaskFields = usePMStore(s => s.updateTaskFields)

  useEffect(() => { setLocalValue(value) }, [value])

  const save = async () => {
    const trimmed = localValue.trim()
    setEditing(false)
    if (trimmed !== value) {
      await updateTaskFields(taskId, { [field]: trimmed })
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 type-body-sm group/ilf cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditing(true) }}>
        <span className="font-semibold text-xs text-muted-foreground">{label}:</span>
        <span>{value || `(no ${label.toLowerCase()})`}</span>
        <AppIcon name="edit" size={11} className="text-muted-foreground opacity-0 group-hover/ilf:opacity-100 transition-opacity" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 type-body-sm" onClick={(e) => e.stopPropagation()}>
      <span className="font-semibold text-xs text-muted-foreground">{label}:</span>
      <input
        autoFocus
        className="flex-1 type-body-sm px-1.5 py-0.5 rounded border border-[var(--color-accent)] bg-[var(--bg-surface)] text-foreground outline-none"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          else if (e.key === 'Escape') { setLocalValue(value); setEditing(false) }
        }}
        onBlur={save}
      />
    </div>
  )
}

interface NodeHeaderProps {
  node: NodeDetail
  childCount?: number
}

type SectionId = 'detail' | 'files' | 'agents' | 'plan' | 'log'

export function NodeHeader({ node, childCount: _childCount }: NodeHeaderProps) {
  const [backlogExpanded, setBacklogExpanded] = useState(false)
  // Single-section mode: exactly one section visible at a time. Clicking a different
  // section replaces the current one (radio). Clicking the active section is a no-op.
  // Resets to 'files' on node change; pendingNodeTab effect can override to plan/log.
  // The 'detail' section was dropped from the segmented control on 2026-05-16; the
  // rendering branch below is unreachable, kept in place for future reactivation.
  const [activeSection, setActiveSection] = useState<SectionId>('files')
  const updateTaskFields = usePMStore(s => s.updateTaskFields)
  const openFilePreview = usePMStore(s => s.openFilePreview)

  const worklogFile = node.files.find(f => f.name === 'worklog.md')
  const hasPlan = worklogFile?.has_plan ?? false
  const hasLog = worklogFile?.has_log ?? false
  const isDomain = node.type === 'domain'
  const planProgress = worklogFile?.plan_progress
  const displayId = displayPMNodeId(node.id)
  const visibleLiveAgentCount = node.sessions.filter(isVisibleLiveAgentSession).length
  const pastAgentCount = (node.past_sessions || []).length

  const hasFiles = node.files.length > 0
  const hasAgents = visibleLiveAgentCount > 0 || pastAgentCount > 0

  // Reset to 'files' on node change so each task opens predictably.
  useEffect(() => { setActiveSection('files') }, [node.id])

  // Apply pending tab from navigateToWorklog — auto-open the requested panel
  const pendingNodeTab = usePMStore(s => s.pendingNodeTab)
  useEffect(() => {
    if (pendingNodeTab === 'plan' && hasPlan) {
      setActiveSection('plan')
      usePMStore.setState({ pendingNodeTab: null })
    } else if (pendingNodeTab === 'log' && hasLog) {
      setActiveSection('log')
      usePMStore.setState({ pendingNodeTab: null })
    } else if (pendingNodeTab) {
      usePMStore.setState({ pendingNodeTab: null })
    }
  }, [node.id, pendingNodeTab, hasPlan, hasLog])

  const toggleSection = (id: SectionId) => {
    if (id !== activeSection) setActiveSection(id)
  }

  const openWorklogFile = () => {
    if (worklogFile) openFilePreview(worklogFile.path, worklogFile.name, 'file')
  }

  // All sections are always clickable — empty states are rendered inside the
  // panels themselves (e.g., "No plan yet"). The `count` is still set when
  // there's content so the badge appears, but the tab button never disables.
  // 'detail' intentionally omitted — dropped from the segmented control on 2026-05-16.
  // The Detail rendering branch in the JSX below is unreachable as a result, kept in
  // place for future reactivation in a different surface.
  //
  // Plan / Log are content-aware: only available when the server reports that the
  // worklog has a renderable plan/log section. Unavailable sections are filtered out
  // (hidden, not disabled) — this naturally hides them on domains/projects (no worklog)
  // and on tasks whose worklog lacks plan/log YAML structure.
  const allSections: { id: SectionId; available: boolean; icon: ReturnType<typeof segmentIcon>; label: string; count?: string }[] = [
    { id: 'files', available: true, icon: segmentIcon('files'), label: 'Files', count: hasFiles ? `${node.files.length}` : undefined },
    { id: 'agents', available: true, icon: segmentIcon('agent'), label: 'Agents', count: hasAgents ? `${visibleLiveAgentCount + pastAgentCount}` : undefined },
    { id: 'plan', available: hasPlan, icon: segmentIcon('plan'), label: 'Plan', count: planProgress ? `${planProgress.done}/${planProgress.total}` : undefined },
    { id: 'log', available: hasLog, icon: segmentIcon('worklog'), label: 'Log' },
  ]
  const sections = allSections.filter(s => s.available)

  // If the currently active section just became unavailable (e.g. user navigated
  // from a task-with-plan to a domain), fall back to 'files'.
  useEffect(() => {
    if (activeSection === 'plan' && !hasPlan) setActiveSection('files')
    else if (activeSection === 'log' && !hasLog) setActiveSection('files')
  }, [hasPlan, hasLog, activeSection])

  return (
    <div className="node-header-card bg-card border border-border rounded-md p-4 flex flex-col gap-2.5">
      {/* === HEADER (always visible) === */}

      {/* Title row */}
      <div className="flex items-center gap-2.5 justify-between">
        <TitleEditor title={node.title} taskId={node.id} displayId={displayId} />
        <StatusDropdown status={node.status} taskId={node.id} />
      </div>

      {/* Description (editable YAML desc — one-liner) */}
      <DescEditor desc={node.desc || ''} taskId={node.id} />

      {/* Metadata row, progress bar, and goal/autonomy/owner chips intentionally
          omitted from the selected-card header (per 2026-05-17 request). Editors
          remain available for future re-introduction on a different surface. */}

      {/* === SEGMENTED CONTROL + PANELS === */}
      <div className="border-t border-[var(--color-border-subtle)] mt-1 pt-2">
        <SegmentedControl
          className="mb-2"
          variant="segmented"
          items={sections.map(s => ({ id: s.id, label: s.label, icon: s.icon, count: s.count }))}
          value={activeSection}
          onValueChange={(id) => toggleSection(id as SectionId)}
        />

        <div className="nh-panels">
          {sections.filter(s => s.id === activeSection).map(s => (
              <div key={s.id} className="nh-panel">
                <div className="nh-panel-hdr">
                  <s.icon size={11} />
                  <span>{s.label}</span>
                  {s.count && <span className="nh-panel-count">{s.count}</span>}
                </div>
                <div className="nh-panel-body">
                  {s.id === 'detail' && (
                    isDomain ? (
                      <div className="flex flex-col gap-2">
                        <InlineFieldEditor value={node.focus || ''} label="Focus" taskId={node.id} field="focus" />
                        <InlineFieldEditor value={node.horizon || ''} label="Horizon" taskId={node.id} field="horizon" />
                        <Section label="Purpose" defaultOpen>
                          <InlineMarkdownEditor
                            value={node.context?.purpose || ''}
                            onSave={(val) => updateTaskFields(node.id, { context: { purpose: val } })}
                            placeholder="Click to add purpose..."
                            minHeight="2em"
                          />
                        </Section>
                        <Section label="Open Questions" count={(node.open_questions || []).length}>
                          <StringListEditor
                            items={node.open_questions || []}
                            label=""
                            placeholder="Unresolved question..."
                            onSave={(items) => updateTaskFields(node.id, { open_questions: items })}
                          />
                        </Section>
                        <Section label="Priorities" count={(node.priorities || []).length}>
                          <StringListEditor
                            items={node.priorities || []}
                            label=""
                            placeholder="Priority item..."
                            onSave={(items) => updateTaskFields(node.id, { priorities: items })}
                          />
                        </Section>
                        <Section label="Background" count={(node.context?.background || []).length}>
                          <StringListEditor
                            items={node.context?.background || []}
                            label=""
                            placeholder="Technology, methodology, constraint..."
                            onSave={(items) => updateTaskFields(node.id, { context: { background: items } })}
                          />
                        </Section>
                        <Section label="Decisions" count={(node.context?.decisions || []).length}>
                          <StringListEditor
                            items={node.context?.decisions || []}
                            label=""
                            placeholder="Key decision..."
                            onSave={(items) => updateTaskFields(node.id, { context: { decisions: items } })}
                          />
                        </Section>
                        <Section label="References" count={(node.context?.references || []).length}>
                          <StringListEditor
                            items={node.context?.references || []}
                            label=""
                            placeholder="Path or link..."
                            onSave={(items) => updateTaskFields(node.id, { context: { references: items } })}
                          />
                        </Section>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Section label="Dependencies" defaultOpen={!!(node.deps && node.deps.length)} count={(node.deps || []).length}>
                          <DepsEditor currentDeps={node.deps} taskId={node.id} />
                        </Section>
                        <Section label="Done When" count={node.done_when?.length}>
                          <DoneWhenEditor items={node.done_when} taskId={node.id} />
                        </Section>
                        <Section label="Objective" defaultOpen>
                          <InlineMarkdownEditor
                            value={node.objective || ''}
                            onSave={(val) => updateTaskFields(node.id, { objective: val })}
                            placeholder="Click to add objective..."
                            minHeight="3em"
                          />
                        </Section>
                        <Section label="Outcome" defaultOpen={!!node.outcome}>
                          <InlineMarkdownEditor
                            value={node.outcome || ''}
                            onSave={(val) => updateTaskFields(node.id, { outcome: val })}
                            placeholder="Click to add outcome..."
                          />
                        </Section>
                      </div>
                    )
                  )}
                  {s.id === 'files' && node.path && (
                    <FileColumn files={node.files} nodePath={node.path} mode="column" maxHeight={260} />
                  )}
                  {s.id === 'agents' && <NodeAgentsPanel nodePath={node.path} nodeId={node.id} />}
                  {s.id === 'plan' && (
                    hasPlan ? <PlanTab nodeId={node.id} onEditFull={openWorklogFile} /> : <div className="type-micro text-muted-foreground py-3 text-center">No plan yet</div>
                  )}
                  {s.id === 'log' && (
                    hasLog ? <LogTab nodeId={node.id} onEditFull={openWorklogFile} /> : <div className="type-micro text-muted-foreground py-3 text-center">No log yet</div>
                  )}
                </div>
              </div>
          ))}
        </div>
      </div>

      {/* Backlog */}
      {node.backlog && node.backlog.length > 0 && (
        <div className="border-t border-[var(--color-border-subtle)] pt-2">
          <button
            className="flex items-center gap-1 bg-transparent border-none text-xs font-semibold text-muted-foreground cursor-pointer py-1 px-0 hover:text-foreground"
            onClick={() => setBacklogExpanded(!backlogExpanded)}
          >
            <AppIcon name={backlogExpanded ? 'chevron-down' : 'chevron-right'} size={14} />
            Backlog ({node.backlog.length} items)
          </button>
          {backlogExpanded && (
            <div className="flex flex-col gap-1 mt-1">
              {node.backlog.map((item, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-xs border-b border-dashed border-[var(--color-border-subtle)] last:border-b-0">
                  <span className="flex-1 min-w-0">{item.title}</span>
                  {item.size && <PMBadge variant="size">{item.size}</PMBadge>}
                  {item.goal && <PMBadge variant="goal">{item.goal}</PMBadge>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

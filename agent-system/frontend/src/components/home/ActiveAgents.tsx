import { Fragment, useEffect, useMemo, useState, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'

import type { Session } from '@/lib/types.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { usePMStore } from '@/stores/pm-store.ts'
import { useHomeLayoutStore } from '@/stores/home-layout-store.ts'
import type { HomeGroup } from '@/lib/api.ts'
import { LiveAgentCard } from './LiveAgentCard.tsx'
import * as api from '@/lib/api.ts'

const HIDDEN_AGENT_ROLES = new Set(['chainlink', 'verifier', 'shadow'])

// Stable references — passing a fresh array/object into dnd-kit on every
// render triggers its internal reducer each pass, which in prod builds can
// surface as React #185 "too many re-renders".
const DND_MODIFIERS = [restrictToVerticalAxis]
const SORTABLE_GROUP_DATA = { kind: 'group' as const }

function isLive(s: Session): boolean {
  return (
    s.status !== 'dead' &&
    s.status !== 'ended' &&
    !s.name.startsWith('helper_') &&
    !(s.agent_role && HIDDEN_AGENT_ROLES.has(s.agent_role))
  )
}

function autoGroupForSession(s: Session, groups: HomeGroup[]): string {
  for (const g of groups) {
    if (g.kind === 'auto:role' && g.role && s.agent_role === g.role) return g.id
  }
  const other = groups.find(g => g.kind === 'auto:other')
  return other?.id || 'other'
}

interface GroupBucket {
  group: HomeGroup
  sessions: Session[]
}

// --- Section header ------------------------------------------------------

function SectionHeader({
  label,
  count,
  collapsed,
  onToggle,
}: {
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
}) {
  const Chev = collapsed ? ChevronRight : ChevronDown
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <button
        className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0 hover:text-foreground"
        onClick={onToggle}
      >
        <Chev size={14} className="text-muted-foreground" />
        <h2 className="type-body-sm font-semibold text-foreground m-0">{label}</h2>
        {count > 0 && (
          <span className="type-micro text-muted-foreground">({count})</span>
        )}
      </button>
    </div>
  )
}

// --- Group header with rename + optional delete --------------------------

function GroupHeader({
  group,
  count,
  onToggle,
  dragListeners,
  readOnly,
  collapsed,
}: {
  group: HomeGroup
  count: number
  onToggle: () => void
  dragListeners?: Record<string, unknown>
  readOnly?: boolean
  collapsed?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const spanRef = useRef<HTMLSpanElement>(null)
  const renameGroup = useHomeLayoutStore(s => s.renameGroup)
  const deleteGroup = useHomeLayoutStore(s => s.deleteGroup)
  const effectiveCollapsed = collapsed ?? group.collapsed
  const Chev = effectiveCollapsed ? ChevronRight : ChevronDown

  useEffect(() => {
    if (!editing && spanRef.current && spanRef.current.textContent !== group.label) {
      spanRef.current.textContent = group.label
    }
  }, [group.label, editing])

  const isUser = group.kind === 'user'
  const canEdit = isUser && !readOnly

  const beginEdit = () => {
    if (!canEdit) return
    setEditing(true)
    requestAnimationFrame(() => {
      const el = spanRef.current
      if (!el) return
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
  }

  const save = () => {
    const el = spanRef.current
    if (!el) return
    const next = (el.textContent || '').trim()
    setEditing(false)
    if (next && next !== group.label) renameGroup(group.id, next)
    else el.textContent = group.label
  }

  const cancel = () => {
    if (spanRef.current) spanRef.current.textContent = group.label
    setEditing(false)
  }

  const canDrag = !!dragListeners && !editing
  const stopDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() }

  return (
    <div
      className={`flex items-center gap-1 pb-1 group/grp select-none ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
      {...(canDrag ? dragListeners : {})}
      title={canDrag ? 'Drag to reorder group' : undefined}
    >
      <button
        {...stopDrag}
        className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0 hover:text-foreground"
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        title={effectiveCollapsed ? 'Expand' : 'Collapse'}
      >
        <Chev size={12} className="text-muted-foreground" />
      </button>
      <span
        ref={spanRef}
        {...(editing ? stopDrag : {})}
        className={`type-micro font-semibold text-[var(--color-text-subtle)] outline-none ${
          canEdit ? 'cursor-text' : 'cursor-pointer'
        } ${editing ? 'bg-[var(--color-accent)]/10 px-1 rounded' : ''}`}
        contentEditable={editing ? 'plaintext-only' : false}
        suppressContentEditableWarning
        onClick={(e) => {
          if (editing) { e.stopPropagation(); return }
          if (!canEdit) { e.stopPropagation(); onToggle() }
        }}
        onDoubleClick={(e) => {
          if (canEdit) { e.stopPropagation(); beginEdit() }
        }}
        onKeyDown={(e) => {
          if (!editing) return
          e.stopPropagation()
          if (e.key === 'Enter') { e.preventDefault(); save() }
          else if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        onBlur={() => { if (editing) save() }}
        title={canEdit ? 'Double-click to rename' : undefined}
      >
        {group.label}
      </span>
      {count > 0 && (
        <span className="type-caption text-muted-foreground">({count})</span>
      )}
      <span className="flex-1 h-px bg-[var(--color-border-subtle)] ml-2" />
      {isUser && !readOnly && (
        <button
          {...stopDrag}
          className="opacity-0 group-hover/grp:opacity-60 hover:opacity-100 text-muted-foreground hover:text-red-400 bg-transparent border-none cursor-pointer p-0.5 transition-opacity"
          onClick={(e) => { e.stopPropagation(); deleteGroup(group.id) }}
          title="Delete group (sessions return to auto buckets)"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}

// --- Droppable / sortable wrappers ---------------------------------------

function SortableSession({ session, compactMode }: { session: Session; compactMode?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `s:${session.name}`,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <LiveAgentCard session={session} compactMode={compactMode} />
    </div>
  )
}

function GroupDropZone({
  group,
  sessions,
  compactMode,
  isEmpty,
}: {
  group: HomeGroup
  sessions: Session[]
  compactMode?: boolean
  isEmpty: boolean
}) {
  const sessionIds = useMemo(() => sessions.map(s => `s:${s.name}`), [sessions])

  return (
    <SortableContext items={sessionIds} strategy={verticalListSortingStrategy}>
      <div className="flex flex-col gap-1.5 min-h-[20px]">
        {sessions.map(s => (
          <SortableSession key={s.name} session={s} compactMode={compactMode} />
        ))}
        {isEmpty && <EmptyGroupDropZone groupId={group.id} />}
      </div>
    </SortableContext>
  )
}

function EmptyGroupDropZone({ groupId }: { groupId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `dz:${groupId}` })
  return (
    <div
      ref={setNodeRef}
      className={`type-caption italic text-center py-2 border border-dashed rounded transition-colors ${
        isOver
          ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/5'
          : 'border-[var(--color-border-subtle)] text-muted-foreground'
      }`}
    >
      Drop a session here
    </div>
  )
}

function SortableGroup({
  group,
  sessions,
  compactMode,
}: {
  group: HomeGroup
  sessions: Session[]
  compactMode?: boolean
}) {
  const toggleGroup = useHomeLayoutStore(s => s.toggleGroupCollapsed)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `g:${group.id}`,
    data: SORTABLE_GROUP_DATA,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <GroupHeader
        group={group}
        count={sessions.length}
        onToggle={() => toggleGroup(group.id)}
        dragListeners={{ ...attributes, ...listeners } as Record<string, unknown>}
      />
      {!group.collapsed && (
        <GroupDropZone
          group={group}
          sessions={sessions}
          compactMode={compactMode}
          isEmpty={sessions.length === 0 && group.kind === 'user'}
        />
      )}
    </div>
  )
}

// --- Read-only (no-DnD) group/card wrappers ------------------------------

function ReadOnlyGroup({
  group,
  sessions,
  compactMode,
}: {
  group: HomeGroup
  sessions: Session[]
  compactMode?: boolean
}) {
  // Local collapse state: clicking the chevron inside an embedded widget
  // must not mutate the home layout store. Seed from the group's current
  // collapsed flag so the initial render matches the home page.
  const [collapsed, setCollapsed] = useState(!!group.collapsed)
  return (
    <div className="mb-3">
      <GroupHeader
        group={group}
        count={sessions.length}
        readOnly
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />
      {!collapsed && (
        <div className="flex flex-col gap-1.5 min-h-[20px] rounded">
          {sessions.map(s => (
            <LiveAgentCard key={s.name} session={s} compactMode={compactMode} />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Hook: live agents + bucket layout, with optional session filter ------

export function useLiveAgentsFiltered(filter?: (s: Session) => boolean): {
  live: Session[]
  buckets: GroupBucket[]
  layout: ReturnType<typeof useHomeLayoutStore.getState>['layout']
  loaded: boolean
} {
  const sessions = useSessionStore(s => s.sessions)
  const layout = useHomeLayoutStore(s => s.layout)
  const loaded = useHomeLayoutStore(s => s.loaded)
  const loadLayout = useHomeLayoutStore(s => s.loadLayout)

  useEffect(() => {
    loadLayout()
  }, [loadLayout])

  useEffect(() => {
    if (Object.keys(usePMStore.getState().sessionCards).length === 0) {
      api.fetchSessionCards()
        .then(data => usePMStore.setState({ sessionCards: data.cards }))
        .catch(() => {})
    }
  }, [])

  const live = useMemo(() => {
    const base = sessions.filter(isLive)
    return filter ? base.filter(filter) : base
  }, [sessions, filter])

  const buckets = useMemo<GroupBucket[]>(() => {
    if (!layout) return []
    const byGroup = new Map<string, Session[]>()
    for (const g of layout.groups) byGroup.set(g.id, [])

    for (const s of live) {
      const placement = layout.placements[s.name]
      const gid = placement?.group && byGroup.has(placement.group)
        ? placement.group
        : autoGroupForSession(s, layout.groups)
      const bucket = byGroup.get(gid)
      if (bucket) bucket.push(s)
      else {
        const other = layout.groups.find(g => g.kind === 'auto:other')
        if (other) byGroup.get(other.id)!.push(s)
      }
    }

    for (const [gid, list] of byGroup.entries()) {
      list.sort((a, b) => {
        const pa = layout.placements[a.name]
        const pb = layout.placements[b.name]
        const oa = pa?.group === gid ? pa.order : Number.MAX_SAFE_INTEGER
        const ob = pb?.group === gid ? pb.order : Number.MAX_SAFE_INTEGER
        if (oa !== ob) return oa - ob
        return a.name.localeCompare(b.name)
      })
    }

    const sortedGroups = [...layout.groups].sort((a, b) => a.order - b.order)
    return sortedGroups.map(g => ({ group: g, sessions: byGroup.get(g.id) || [] }))
  }, [layout, live])

  return { live, buckets, layout, loaded }
}

// --- Main component ------------------------------------------------------

export interface ActiveAgentsProps {
  filter?: (s: Session) => boolean
  readOnly?: boolean
  emptyState?: React.ReactNode
  compactMode?: boolean
  /** When true (in readOnly mode), skip group headers and render sessions flat. */
  suppressGroupHeaders?: boolean
}

export function ActiveAgents({ filter, readOnly, emptyState, compactMode, suppressGroupHeaders }: ActiveAgentsProps = {}) {
  const { live, buckets, layout, loaded } = useLiveAgentsFiltered(filter)
  const setSectionCollapsed = useHomeLayoutStore(s => s.setSectionCollapsed)
  const createGroup = useHomeLayoutStore(s => s.createGroup)
  const setPlacements = useHomeLayoutStore(s => s.setPlacements)
  const reorderGroups = useHomeLayoutStore(s => s.reorderGroups)

  const isEmbedded = !!(filter || readOnly || emptyState || compactMode)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const visibleBuckets = useMemo(
    () => buckets.filter(b => b.sessions.length > 0 || (!isEmbedded && b.group.kind === 'user')),
    [buckets, isEmbedded],
  )
  const groupIds = useMemo(() => visibleBuckets.map(b => `g:${b.group.id}`), [visibleBuckets])

  // Cross-group displacement animation is enabled only on the safe path:
  // target is a session (overId=`s:`, not `dz:`) AND source won't transition
  // empty after the move. See SessionRail.tsx for the full ping-pong rationale.
  // Drops into empty/dz zones still work via handleDragEnd.
  const handleDragOver = useCallback((e: DragOverEvent) => {
    if (!e.over || !layout) return
    const activeId = String(e.active.id)
    const overId = String(e.over.id)
    if (activeId === overId || !activeId.startsWith('s:')) return

    if (!overId.startsWith('s:')) return

    const sessionName = activeId.slice(2)
    const sourceBucket = visibleBuckets.find(b => b.sessions.some(s => s.name === sessionName))
    if (!sourceBucket) return

    const overName = overId.slice(2)
    const targetBucket = visibleBuckets.find(b => b.sessions.some(s => s.name === overName))
    if (!targetBucket) return
    if (sourceBucket.group.id === targetBucket.group.id) return

    if (sourceBucket.sessions.length === 1 && sourceBucket.group.kind === 'user') return

    const placements = { ...layout.placements }
    placements[sessionName] = {
      group: targetBucket.group.id,
      order: targetBucket.sessions.length,
    }
    sourceBucket.sessions
      .filter(s => s.name !== sessionName)
      .forEach((s, idx) => {
        placements[s.name] = { group: sourceBucket.group.id, order: idx }
      })
    setPlacements(placements)
  }, [layout, visibleBuckets, setPlacements])

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    if (!e.over || !layout) return
    const activeId = String(e.active.id)
    const overId = String(e.over.id)
    if (activeId === overId) return

    // Group reorder — trigger from any valid over-target (g:, s:, dz:)
    if (activeId.startsWith('g:')) {
      const aGid = activeId.slice(2)
      let oGid: string | null = null
      if (overId.startsWith('g:')) oGid = overId.slice(2)
      else if (overId.startsWith('s:')) {
        const overName = overId.slice(2)
        oGid = visibleBuckets.find(b => b.sessions.some(s => s.name === overName))?.group.id ?? null
      } else if (overId.startsWith('dz:')) {
        oGid = overId.slice(3)
      }
      if (!oGid || aGid === oGid) return
      const ids = visibleBuckets.map(b => b.group.id)
      const from = ids.indexOf(aGid)
      const to = ids.indexOf(oGid)
      if (from < 0 || to < 0) return
      const next = [...ids]
      next.splice(from, 1)
      next.splice(to, 0, aGid)
      reorderGroups(next)
      return
    }

    // Session move / reorder — session drops on `g:` are ignored, matching
    // the sidebar. Use dz: (drop zone) or s: (explicit slot) only.
    if (activeId.startsWith('s:')) {
      const sessionName = activeId.slice(2)
      const sourceBucket = visibleBuckets.find(b => b.sessions.some(s => s.name === sessionName))
      if (!sourceBucket) return

      let targetBucket: GroupBucket | undefined
      let targetIndex: number
      if (overId.startsWith('dz:')) {
        const targetGroupId = overId.slice(3)
        targetBucket = visibleBuckets.find(b => b.group.id === targetGroupId)
        if (!targetBucket) return
        targetIndex = targetBucket.sessions.length
      } else if (overId.startsWith('s:')) {
        const overName = overId.slice(2)
        targetBucket = visibleBuckets.find(b => b.sessions.some(s => s.name === overName))
        if (!targetBucket) return
        targetIndex = targetBucket.sessions.findIndex(s => s.name === overName)
      } else {
        return
      }

      const sameGroup = sourceBucket.group.id === targetBucket.group.id
      let newTargetList: Session[]
      let newSourceList: Session[]
      if (sameGroup) {
        const list = [...sourceBucket.sessions]
        const fromIdx = list.findIndex(s => s.name === sessionName)
        if (fromIdx < 0) return
        const [moved] = list.splice(fromIdx, 1)
        const insertAt = Math.min(Math.max(targetIndex, 0), list.length)
        list.splice(insertAt, 0, moved)
        newSourceList = list
        newTargetList = list
      } else {
        const moved = sourceBucket.sessions.find(s => s.name === sessionName)
        if (!moved) return
        newSourceList = sourceBucket.sessions.filter(s => s.name !== sessionName)
        newTargetList = [...targetBucket.sessions]
        const insertAt = Math.min(Math.max(targetIndex, 0), newTargetList.length)
        newTargetList.splice(insertAt, 0, moved)
      }

      const placements = { ...layout.placements }
      newSourceList.forEach((s, idx) => {
        placements[s.name] = { group: sourceBucket.group.id, order: idx }
      })
      if (!sameGroup) {
        newTargetList.forEach((s, idx) => {
          placements[s.name] = { group: targetBucket!.group.id, order: idx }
        })
      }
      setPlacements(placements)
    }
  }, [layout, visibleBuckets, reorderGroups, setPlacements])

  if (!loaded || !layout) return null

  if (live.length === 0) {
    if (emptyState) return <>{emptyState}</>
    return null
  }

  const activeSection = layout.sections.active || { collapsed: false }

  // Read-only / embedded: render groups + cards with no DnD wrappers and
  // without the "+ New group" button.
  if (readOnly) {
    if (suppressGroupHeaders) {
      const flat = visibleBuckets.flatMap(b => b.sessions)
      return (
        <div className={isEmbedded ? undefined : 'mb-4'}>
          <div className="flex flex-col gap-1.5">
            {flat.map(s => (
              <LiveAgentCard key={s.name} session={s} compactMode={compactMode} />
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className={isEmbedded ? undefined : 'mb-4'}>
        {visibleBuckets.map(({ group, sessions }) => (
          <ReadOnlyGroup
            key={group.id}
            group={group}
            sessions={sessions}
            compactMode={compactMode}
          />
        ))}
      </div>
    )
  }

  const content = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      modifiers={DND_MODIFIERS}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
        {visibleBuckets.map(({ group, sessions }, idx) => {
          const next = visibleBuckets[idx + 1]
          // Render "+ New group" button once, after the last contiguous
          // user-or-task-agent group. Creating a new group inserts above
          // this button (at the end of the user cluster).
          const belongsToCluster =
            group.role === 'task-agent' || group.kind === 'user'
          const nextBelongs =
            next && (next.group.role === 'task-agent' || next.group.kind === 'user')
          const showNewGroupBtn = !isEmbedded && belongsToCluster && !nextBelongs
          return (
            <Fragment key={group.id}>
              <SortableGroup
                group={group}
                sessions={sessions}
                compactMode={compactMode}
              />
              {showNewGroupBtn && (
                <button
                  className="flex items-center gap-1 type-micro text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0 mb-3 -mt-1 transition-colors"
                  onClick={() => createGroup('New Group')}
                  title="Create a new group"
                >
                  <Plus size={11} />
                  <span>New group</span>
                </button>
              )}
            </Fragment>
          )
        })}
      </SortableContext>
    </DndContext>
  )

  if (isEmbedded) {
    return <div>{content}</div>
  }

  return (
    <div className="mb-4">
      <SectionHeader
        label="Active Agents"
        count={live.length}
        collapsed={activeSection.collapsed}
        onToggle={() => setSectionCollapsed('active', !activeSection.collapsed)}
      />
      {!activeSection.collapsed && content}
    </div>
  )
}

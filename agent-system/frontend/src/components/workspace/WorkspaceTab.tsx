import { useCallback, useRef, useState } from 'react'
import type { IDockviewPanelHeaderProps } from 'dockview'
import { FileText, X, MoreHorizontal } from 'lucide-react'
import { useTabStore } from '@/stores/tab-store.ts'
import type { AgentTabData, DocTabData } from '@/stores/tab-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { StatusDot } from '@/components/primitives'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.tsx'

type DotStatus = 'working' | 'idle' | 'waiting' | 'unknown'

function statusToDot(status?: string): DotStatus {
  if (status === 'working') return 'working'
  if (status === 'idle') return 'idle'
  if (status === 'waiting_input') return 'waiting'
  if (status === 'login_required') return 'waiting'
  return 'unknown'
}

function basename(path: string): string {
  return path.split('/').pop() || path
}

export function WorkspaceTab({ api, params: _params }: IDockviewPanelHeaderProps) {
  const panelId = api.id
  const tabData = useTabStore(s => s.tabData[panelId])

  // Middle-click close handling (same as dockview default)
  const isMiddle = useRef(false)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isMiddle.current = e.button === 1
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (isMiddle.current && e.button === 1) {
      isMiddle.current = false
      e.preventDefault()
      api.close()
    }
  }, [api])
  const onPointerLeave = useCallback(() => {
    isMiddle.current = false
  }, [])

  const onClose = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    api.close()
  }, [api])

  if (!tabData) {
    return <DefaultTabFallback api={api} />
  }

  if (tabData.type === 'agent') {
    return (
      <AgentTab
        panelId={panelId}
        data={tabData as AgentTabData}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onClose={onClose}
      />
    )
  }

  if (tabData.type === 'doc') {
    return (
      <DocTab
        panelId={panelId}
        data={tabData as DocTabData}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onClose={onClose}
      />
    )
  }

  // PM tab or unknown — minimal fallback
  return <DefaultTabFallback api={api} />
}

// ─── Agent tab ──────────────────────────────────────────────

interface AgentTabProps {
  panelId: string
  data: AgentTabData
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerLeave: () => void
  onClose: (e: React.MouseEvent) => void
}

function AgentTab({ panelId, data, onPointerDown, onPointerUp, onPointerLeave, onClose }: AgentTabProps) {
  const sessionStatus = useSessionStore(s => s.sessionStatuses[data.sessionName])
  const session = useSessionStore(s => s.sessions.find(sess => sess.name === data.sessionName))
  const getDisplayTitle = useSessionStore(s => s.getDisplayTitle)
  const displayTitle = session ? getDisplayTitle(session) : data.sessionName
  const isReadOnly = data.readOnly
  const [menuOpen, setMenuOpen] = useState(false)

  const onDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('tab-panel-id', panelId)
    e.dataTransfer.setData('tab-data-json', JSON.stringify(data))
    e.dataTransfer.effectAllowed = 'copyMove'
  }, [panelId, data])

  return (
    <div
      className="dv-default-tab group/tab"
      draggable
      onDragStart={onDragStart}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      title={displayTitle}
    >
      <span className={`dv-default-tab-content flex items-center gap-1.5 ${isReadOnly ? 'opacity-60' : ''}`}>
        {isReadOnly ? (
          <span className="shrink-0 type-micro">📜</span>
        ) : (
          <StatusDot status={statusToDot(sessionStatus)} size="sm" className="shrink-0" />
        )}
        <span className="truncate flex-1 min-w-0">{displayTitle}</span>
      </span>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            className="dv-default-tab-action opacity-0 group-hover/tab:opacity-60 hover:!opacity-100"
            onPointerDown={e => e.preventDefault()}
            onClick={e => { e.stopPropagation(); setMenuOpen(true) }}
            title="Tab actions"
          >
            <MoreHorizontal size={10} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-auto" side="bottom" align="end">
          <TabShareMenu panelId={panelId} onClose={() => setMenuOpen(false)} />
          <div className="border-t border-border">
            <button
              className="flex items-center gap-2 px-3 py-1.5 type-micro text-left hover:bg-accent cursor-pointer bg-transparent border-none w-full text-muted-foreground hover:text-foreground"
              onClick={e => { setMenuOpen(false); onClose(e) }}
            >
              <X size={10} /> Close tab
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <button
        className="dv-default-tab-action"
        onPointerDown={e => e.preventDefault()}
        onClick={onClose}
      >
        <X size={10} />
      </button>
    </div>
  )
}

// ─── Tab share menu (⋯) ──────────────────────────────────────

function TabShareMenu({ panelId, onClose }: { panelId: string; onClose: () => void }) {
  const sessions = useSessionStore(s => s.sessions)
  const activeSession = useSessionStore(s => s.activeSession)
  const getDisplayTitle = useSessionStore(s => s.getDisplayTitle)
  const shareTab = useTabStore(s => s.shareTabToSession)

  return (
    <div className="flex flex-col py-1 min-w-[160px]">
      <div className="px-3 py-1 type-caption type-semibold text-muted-foreground uppercase tracking-wide">Share to session</div>
      {sessions.filter(s => s.name !== activeSession).map(s => (
        <button
          key={s.name}
          className="flex items-center gap-2 px-3 py-1.5 type-micro text-left hover:bg-accent cursor-pointer bg-transparent border-none"
          onClick={() => { shareTab(panelId, s.name); onClose() }}
        >
          <StatusDot status={statusToDot(s.status)} size="sm" />
          <span className="truncate">{getDisplayTitle(s)}</span>
        </button>
      ))}
      {sessions.filter(s => s.name !== activeSession).length === 0 && (
        <div className="px-3 py-1.5 type-micro text-muted-foreground">No other sessions</div>
      )}
    </div>
  )
}

// ─── Doc tab ────────────────────────────────────────────────

interface DocTabProps {
  panelId: string
  data: DocTabData
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerLeave: () => void
  onClose: (e: React.MouseEvent) => void
}

function DocTab({ panelId, data, onPointerDown, onPointerUp, onPointerLeave, onClose }: DocTabProps) {
  const fullTitle = data.currentPath
  const [menuOpen, setMenuOpen] = useState(false)

  const onDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('tab-panel-id', panelId)
    e.dataTransfer.setData('tab-data-json', JSON.stringify(data))
    e.dataTransfer.effectAllowed = 'copyMove'
  }, [panelId, data])

  return (
    <div
      className="dv-default-tab group/tab"
      draggable
      onDragStart={onDragStart}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      title={fullTitle}
    >
      <span className="dv-default-tab-content flex items-center gap-1.5">
        <FileText size={12} className="shrink-0 text-muted-foreground" />
        <span className="truncate flex-1 min-w-0">{basename(data.currentPath)}</span>
        {data.isDirty && <span className="type-caption text-orange">●</span>}
      </span>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            className="dv-default-tab-action opacity-0 group-hover/tab:opacity-60 hover:!opacity-100"
            onPointerDown={e => e.preventDefault()}
            onClick={e => { e.stopPropagation(); setMenuOpen(true) }}
            title="Tab actions"
          >
            <MoreHorizontal size={10} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-auto" side="bottom" align="end">
          <TabShareMenu panelId={panelId} onClose={() => setMenuOpen(false)} />
          <div className="border-t border-border">
            <button
              className="flex items-center gap-2 px-3 py-1.5 type-micro text-left hover:bg-accent cursor-pointer bg-transparent border-none w-full text-muted-foreground hover:text-foreground"
              onClick={e => { setMenuOpen(false); onClose(e) }}
            >
              <X size={10} /> Close tab
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <button
        className="dv-default-tab-action"
        onPointerDown={e => e.preventDefault()}
        onClick={onClose}
      >
        <X size={10} />
      </button>
    </div>
  )
}

// ─── Fallback (for PM tabs or missing data) ─────────────────

function DefaultTabFallback({ api }: { api: { id: string; title: string | undefined; close: () => void } }) {
  return (
    <div className="dv-default-tab">
      <span className="dv-default-tab-content">{api.title ?? ''}</span>
      <div className="dv-default-tab-action" onClick={() => api.close()}>
        <X size={10} />
      </div>
    </div>
  )
}

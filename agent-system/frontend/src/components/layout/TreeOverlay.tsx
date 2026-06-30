import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import type { ChildCard } from '@/stores/pm-store.ts'
import { EntityIcon } from '@/components/primitives'
import { displayPMNodeId } from '@/lib/paths.ts'
import * as api from '@/lib/api.ts'

interface TreeOverlayProps {
  projectId: string
  onNavigate: (nodeId: string | null) => void
}

interface TreeNodeProps {
  node: ChildCard
  projectId: string
  depth: number
  onNavigate: (nodeId: string | null) => void
}

function statusDotClass(status: string): string {
  switch (status) {
    case 'active':
    case 'executing': return 'dot-active'
    case 'done':
    case 'complete': return 'dot-done'
    case 'blocked': return 'dot-blocked'
    default: return 'dot-idle'
  }
}

function TreeNode({ node, projectId, depth, onNavigate }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<ChildCard[]>([])
  const [loading, setLoading] = useState(false)
  const hasChildren = node.has_children || node.type === 'domain'
  const isDomain = node.type === 'domain'

  const handleToggle = async () => {
    if (!hasChildren) return
    if (expanded) {
      setExpanded(false)
      return
    }
    if (children.length === 0) {
      setLoading(true)
      try {
        const data = await api.fetchChildren(projectId, node.id)
        setChildren(data.children)
      } catch { /* ignore */ }
      setLoading(false)
    }
    setExpanded(true)
  }

  return (
    <>
      <div
        className={`to-row${isDomain ? ' dom' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          <span
            className={`to-fold${expanded ? ' op' : ''}`}
            onClick={handleToggle}
          >
            <ChevronRight size={12} />
          </span>
        ) : (
          <span className="to-fold-spacer" />
        )}
        <span className={`to-dot ${statusDotClass(node.status)}`} />
        <span className="to-label" onClick={() => onNavigate(node.id)}>
          <EntityIcon type={node.type} status={node.status} />
          <span className="to-id">{displayPMNodeId(node.id)}</span>
          <span className="to-title">{node.title}</span>
        </span>
      </div>
      {expanded && children.map(child => (
        <TreeNode key={child.id} node={child} projectId={projectId} depth={depth + 1} onNavigate={onNavigate} />
      ))}
      {expanded && loading && (
        <div className="to-loading" style={{ paddingLeft: `${24 + depth * 16}px` }}>Loading...</div>
      )}
    </>
  )
}

export function TreeOverlay({ projectId, onNavigate }: TreeOverlayProps) {
  const state = usePMStore(s => s.state)
  const [rootChildren, setRootChildren] = useState<ChildCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api.fetchChildren(projectId)
        if (!cancelled) setRootChildren(data.children)
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [projectId])

  return (
    <div className="tree-overlay">
      {/* Project root row */}
      <div className="to-row to-root" onClick={() => onNavigate(null)}>
        <EntityIcon type="project" size={13} />
        <span className="to-title" style={{ fontWeight: 600 }}>
          {state?.project || projectId}
        </span>
      </div>

      {loading ? (
        <div className="to-loading">Loading hierarchy...</div>
      ) : (
        rootChildren.map(child => (
          <TreeNode key={child.id} node={child} projectId={projectId} depth={0} onNavigate={onNavigate} />
        ))
      )}
    </div>
  )
}

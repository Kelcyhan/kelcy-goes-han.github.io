import { useEffect, useState } from 'react'
import { useDocsStore } from '@/stores/docs-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import type { TreeNode } from '@/lib/types.ts'

export function FileTree() {
  const { fileTree, loadTree, currentPath } = useDocsStore()

  useEffect(() => {
    if (!fileTree) loadTree()
  }, [fileTree, loadTree])

  if (!fileTree) {
    return (
      <div className="file-tree">
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 'var(--type-body-sm-size)', lineHeight: 'var(--type-body-sm-line)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="file-tree">
      <TreeList nodes={fileTree} activePath={currentPath} />
    </div>
  )
}

function TreeList({ nodes, activePath }: { nodes: TreeNode[]; activePath: string | null }) {
  return (
    <ul className="file-tree-list">
      {nodes.map(node => (
        <TreeItem key={node.path} node={node} activePath={activePath} />
      ))}
    </ul>
  )
}

function TreeItem({ node, activePath }: { node: TreeNode; activePath: string | null }) {
  const [expanded, setExpanded] = useState(false)

  if (node.type === 'dir') {
    return (
      <li className="file-tree-item">
        <div
          onClick={() => setExpanded(!expanded)}
          className={`file-tree-dir ${expanded ? 'expanded' : ''}`}
        >
          <span className="ft-arrow">&#9654;</span>
          <span className="ft-icon">{'\uD83D\uDCC1'}</span>
          {node.name}
        </div>
        {expanded && node.children && (
          <TreeList nodes={node.children} activePath={activePath} />
        )}
      </li>
    )
  }

  const openDocTab = useTabStore(s => s.openDocTab)
  const isActive = activePath === node.path
  const icon = node.name.endsWith('.md') ? '\uD83D\uDCC4' : '\uD83D\uDDCE'

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      openDocTab(node.path, true)
    } else {
      openDocTab(node.path)
    }
  }

  return (
    <li className="file-tree-item">
      <div
        onClick={handleClick}
        className={`file-tree-file ${isActive ? 'active' : ''}`}
      >
        {icon} {node.name}
      </div>
    </li>
  )
}

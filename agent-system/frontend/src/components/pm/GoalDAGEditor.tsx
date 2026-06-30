import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  addEdge,
  Controls,
  Background,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'
import { TaskNode, type TaskNodeData } from './TaskNode.tsx'
import type { SequenceStep, TimelineEntry, TaggedTask } from '@/stores/pm-store.ts'
import { Plus } from 'lucide-react'

// --- Must be defined outside component ---
const nodeTypes = { taskNode: TaskNode }

const NODE_WIDTH = 200
const NODE_HEIGHT = 72

// --- Dagre layout ---

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    nodesep: 40,
    ranksep: 60,
    marginx: 20,
    marginy: 20,
  })

  nodes.forEach(node => {
    g.setNode(node.id, {
      width: node.measured?.width || NODE_WIDTH,
      height: node.measured?.height || NODE_HEIGHT,
    })
  })

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map(node => {
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - (node.measured?.width || NODE_WIDTH) / 2,
        y: pos.y - (node.measured?.height || NODE_HEIGHT) / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

// --- Data conversion ---

function sequenceToNodes(
  sequence: SequenceStep[],
  timeline: TimelineEntry[],
  criticalPath: string[],
  taggedTasks: TaggedTask[],
): Node[] {
  const timelineMap = new Map(timeline.map(t => [t.step_id, t]))
  const taskMap = new Map(taggedTasks.filter(t => t.in_sequence).map(t => [t.id, t]))
  const criticalSet = new Set(criticalPath)

  return sequence.map((step, i) => {
    const tl = timelineMap.get(step.id)
    const task = taskMap.get(step.id)

    const data: TaskNodeData = {
      id: step.id,
      title: step.title || task?.title || step.id,
      status: task?.status || 'todo',
      estHours: task?.est_hours ?? null,
      slackHours: tl?.slack_hours ?? null,
      critical: criticalSet.has(step.id),
    }

    return {
      id: step.id,
      type: 'taskNode',
      position: { x: 0, y: i * 100 }, // initial; dagre will recompute
      data,
    }
  })
}

function sequenceToEdges(sequence: SequenceStep[]): Edge[] {
  const edges: Edge[] = []
  for (const step of sequence) {
    for (const dep of step.depends_on) {
      edges.push({
        id: `${dep}->${step.id}`,
        source: dep,
        target: step.id,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
        style: { stroke: '#6b7280', strokeWidth: 1.5 },
      })
    }
  }
  return edges
}

// --- Cycle detection ---

function wouldCreateCycle(sequence: SequenceStep[], source: string, target: string): boolean {
  // BFS from source backwards — if we reach target, adding target->source creates cycle
  const depsMap = new Map(sequence.map(s => [s.id, s.depends_on]))
  const visited = new Set<string>()
  const queue = [source]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === target) return true
    if (visited.has(current)) continue
    visited.add(current)
    const deps = depsMap.get(current) || []
    queue.push(...deps)
  }
  return false
}

// --- Inner canvas (needs ReactFlowProvider) ---

interface DAGCanvasProps {
  sequence: SequenceStep[]
  timeline: TimelineEntry[]
  criticalPath: string[]
  taggedTasks: TaggedTask[]
  onSequenceChange: (sequence: SequenceStep[]) => void
  onNodeDoubleClick?: (stepId: string) => void
}

function DAGCanvas({ sequence, timeline, criticalPath, taggedTasks, onSequenceChange, onNodeDoubleClick }: DAGCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[])
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const layoutDoneRef = useRef(false)
  const prevSequenceLenRef = useRef(sequence.length)

  // Convert sequence to React Flow nodes/edges
  useEffect(() => {
    const rfNodes = sequenceToNodes(sequence, timeline, criticalPath, taggedTasks)
    const rfEdges = sequenceToEdges(sequence)
    setNodes(rfNodes)
    setEdges(rfEdges)
    layoutDoneRef.current = false
  }, [sequence, timeline, criticalPath, taggedTasks, setNodes, setEdges])

  // Layout after nodes are measured
  useEffect(() => {
    if (nodesInitialized && nodes.length > 0 && !layoutDoneRef.current) {
      const { nodes: layouted } = getLayoutedElements(nodes, edges)
      setNodes(layouted)
      layoutDoneRef.current = true
      window.requestAnimationFrame(() => fitView({ padding: 0.15 }))
    }
  }, [nodesInitialized, nodes, edges, setNodes, fitView])

  // Re-layout when sequence length changes (node added/removed)
  useEffect(() => {
    if (sequence.length !== prevSequenceLenRef.current) {
      prevSequenceLenRef.current = sequence.length
      layoutDoneRef.current = false
    }
  }, [sequence.length])

  // Handle new edge connection
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    // Cycle detection
    if (wouldCreateCycle(sequence, connection.source, connection.target)) return

    const newEdge: Edge = {
      id: `${connection.source}->${connection.target}`,
      source: connection.source!,
      target: connection.target!,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
      style: { stroke: '#6b7280', strokeWidth: 1.5 },
    }
    setEdges(eds => addEdge(newEdge, eds))

    const newSequence = sequence.map(step =>
      step.id === connection.target
        ? { ...step, depends_on: [...step.depends_on, connection.source!] }
        : step
    )
    onSequenceChange(newSequence)
  }, [sequence, onSequenceChange, setEdges])

  // Handle edge deletion
  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    const newSequence = sequence.map(step => {
      const removedSources = deletedEdges
        .filter(e => e.target === step.id)
        .map(e => e.source)
      if (removedSources.length === 0) return step
      return {
        ...step,
        depends_on: step.depends_on.filter(d => !removedSources.includes(d)),
      }
    })
    onSequenceChange(newSequence)
  }, [sequence, onSequenceChange])

  // Handle node deletion
  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    const deletedIds = new Set(deletedNodes.map(n => n.id))
    const newSequence = sequence
      .filter(s => !deletedIds.has(s.id))
      .map(s => ({
        ...s,
        depends_on: s.depends_on.filter(d => !deletedIds.has(d)),
      }))
    onSequenceChange(newSequence)
  }, [sequence, onSequenceChange])

  // Handle double-click to navigate
  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    onNodeDoubleClick?.(node.id)
  }, [onNodeDoubleClick])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onEdgesDelete={onEdgesDelete}
      onNodesDelete={onNodesDelete}
      onNodeDoubleClick={handleNodeDoubleClick}
      nodeTypes={nodeTypes}
      colorMode="light"
      fitView
      minZoom={0.3}
      maxZoom={1.5}
      deleteKeyCode="Delete"
      proOptions={{ hideAttribution: true }}
    >
      <Controls position="bottom-right" showInteractive={false} />
      <Background gap={16} size={1} />
    </ReactFlow>
  )
}

// --- Public component ---

interface GoalDAGEditorProps {
  sequence: SequenceStep[]
  timeline: TimelineEntry[]
  criticalPath: string[]
  taggedTasks: TaggedTask[]
  onSequenceChange: (sequence: SequenceStep[]) => void
  onNodeDoubleClick?: (stepId: string) => void
  onAddStep?: () => void
}

export function GoalDAGEditor({
  sequence,
  timeline,
  criticalPath,
  taggedTasks,
  onSequenceChange,
  onNodeDoubleClick,
  onAddStep,
}: GoalDAGEditorProps) {
  if (sequence.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground type-label border border-border rounded-md bg-[var(--bg-raised)]">
        <p>No sequence steps defined</p>
        {onAddStep && (
          <button
            className="mt-2 flex items-center gap-1 type-micro text-accent-foreground bg-transparent border border-[var(--color-border-subtle)] rounded px-2 py-1 cursor-pointer hover:border-[var(--color-accent)]"
            onClick={onAddStep}
          >
            <Plus size={12} /> Add first step
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="h-[400px] w-full border border-border rounded-md overflow-hidden bg-white">
      <ReactFlowProvider>
        <DAGCanvas
          sequence={sequence}
          timeline={timeline}
          criticalPath={criticalPath}
          taggedTasks={taggedTasks}
          onSequenceChange={onSequenceChange}
          onNodeDoubleClick={onNodeDoubleClick}
        />
      </ReactFlowProvider>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, RefreshCw, Pencil } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'
import type { PlanData } from '@/lib/api.ts'

interface PlanTabProps {
  nodeId: string
  onEditFull: () => void
}

export function PlanTab({ nodeId, onEditFull }: PlanTabProps) {
  const activeProject = usePMStore(s => s.activeProject)
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeProject) return
    setLoading(true)
    setError(null)
    api.fetchPlan(activeProject, nodeId)
      .then(data => { setPlan(data); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to load plan'); setLoading(false) })
  }, [activeProject, nodeId])

  const handleToggle = async (stepIndex: number, currentDone: boolean) => {
    if (!activeProject || !plan) return
    // Optimistic update
    setPlan(prev => {
      if (!prev) return prev
      const newSteps = (prev.steps ?? []).map(s =>
        s.index === stepIndex ? { ...s, done: !currentDone } : s
      )
      const doneCount = newSteps.filter(s => s.done).length
      return { ...prev, steps: newSteps, progress: { done: doneCount, total: newSteps.length } }
    })
    try {
      const result = await api.togglePlanStep(activeProject, nodeId, stepIndex, !currentDone)
      // Update progress from server response
      setPlan(prev => prev ? { ...prev, progress: result.progress } : prev)
      // Refresh node cache so file chip progress badge updates
      usePMStore.getState().refreshCurrentNode()
    } catch {
      // Revert on error
      setPlan(prev => {
        if (!prev) return prev
        const reverted = (prev.steps ?? []).map(s =>
          s.index === stepIndex ? { ...s, done: currentDone } : s
        )
        const doneCount = reverted.filter(s => s.done).length
        return { ...prev, steps: reverted, progress: { done: doneCount, total: reverted.length } }
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
        <RefreshCw size={14} className="animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="text-muted-foreground type-body-sm py-4">{error}</div>
  }

  if (!plan) return null

  const steps = plan.steps ?? []

  // Group steps by phase
  const phases: { name: string | null; steps: typeof steps }[] = []
  let currentPhase: string | null | undefined = undefined // sentinel — null steps won't skip first group
  for (const step of steps) {
    if (step.phase !== currentPhase) {
      currentPhase = step.phase
      phases.push({ name: step.phase, steps: [] })
    }
    phases[phases.length - 1].steps.push(step)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Current Status */}
      {plan.current_status && (
        <div className="type-label text-muted-foreground bg-[var(--bg-surface)] rounded-sm p-2.5 flex flex-col gap-0.5">
          {plan.current_status.done && <div><span className="font-medium">Done:</span> {plan.current_status.done}</div>}
          {plan.current_status.remains && <div><span className="font-medium">Remains:</span> {plan.current_status.remains}</div>}
          {plan.current_status.next && <div><span className="font-medium">Next:</span> {plan.current_status.next}</div>}
          {plan.current_status.blockers && plan.current_status.blockers !== 'None' && plan.current_status.blockers !== 'none' && (
            <div><span className="font-medium text-orange">Blockers:</span> {plan.current_status.blockers}</div>
          )}
        </div>
      )}

      {/* Steps */}
      <div className="flex flex-col gap-1">
        {phases.map((phase, pi) => (
          <div key={pi} className="flex flex-col gap-0.5">
            {phase.name && (
              <div className="type-micro font-semibold text-muted-foreground mt-1.5 first:mt-0">{phase.name}</div>
            )}
            {phase.steps.map(step => (
              <div key={step.index} className="flex items-start gap-1.5 group/step">
                <button
                  className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center shrink-0 mt-0.5"
                  onClick={() => handleToggle(step.index, step.done)}
                  title={step.done ? 'Mark incomplete' : 'Mark complete'}
                >
                  {step.done
                    ? <CheckCircle2 size={13} className="text-green" />
                    : <Circle size={13} className="text-muted-foreground hover:text-accent" />}
                </button>
                <span className={`type-body-sm leading-snug ${step.done ? 'text-muted-foreground line-through' : ''}`}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Scope */}
      {plan.scope && (
        <div className="type-label text-muted-foreground border-t border-[var(--color-border-subtle)] pt-2 flex flex-col gap-1">
          {(plan.scope.in_scope ?? []).length > 0 && (
            <div>
              <span className="font-medium">In scope:</span>{' '}
              {plan.scope.in_scope.join(', ')}
            </div>
          )}
          {(plan.scope.out_scope ?? []).length > 0 && (
            <div>
              <span className="font-medium">Out of scope:</span>{' '}
              {plan.scope.out_scope.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Edit full plan link */}
      <button
        className="inline-flex items-center gap-1 self-start type-micro text-muted-foreground hover:text-accent cursor-pointer bg-transparent border-none p-0 transition-colors"
        onClick={onEditFull}
      >
        <Pencil size={11} /> Edit full plan
      </button>
    </div>
  )
}

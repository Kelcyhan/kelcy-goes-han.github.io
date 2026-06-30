import { useEffect, useState } from 'react'
import { RefreshCw, Pencil } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'
import type { LogData } from '@/lib/api.ts'

interface LogTabProps {
  nodeId: string
  onEditFull: () => void
}

export function LogTab({ nodeId, onEditFull }: LogTabProps) {
  const activeProject = usePMStore(s => s.activeProject)
  const [log, setLog] = useState<LogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeProject) return
    setLoading(true)
    setError(null)
    api.fetchLog(activeProject, nodeId)
      .then(data => { setLog(data); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to load log'); setLoading(false) })
  }, [activeProject, nodeId])

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

  if (!log) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Resume Brief */}
      {log.resume_brief && (
        <div className="type-label text-muted-foreground bg-[var(--bg-surface)] rounded-sm p-2.5 flex flex-col gap-0.5">
          {log.resume_brief.status && <div><span className="font-medium">Status:</span> {log.resume_brief.status}</div>}
          {log.resume_brief.next && <div><span className="font-medium">Next:</span> {log.resume_brief.next}</div>}
          {log.resume_brief.blockers && log.resume_brief.blockers !== 'none' && log.resume_brief.blockers !== 'None' && (
            <div><span className="font-medium text-orange">Blockers:</span> {log.resume_brief.blockers}</div>
          )}
        </div>
      )}

      {/* Log entries */}
      <div className="flex flex-col gap-2">
        {(log.entries ?? []).map((entry, i) => (
          <div key={i} className="border-l-2 border-[var(--color-border-subtle)] pl-2.5 py-0.5">
            <div className="type-micro font-medium text-muted-foreground">{entry.heading}</div>
            {entry.body && (
              <div className="type-label text-muted-foreground mt-0.5 whitespace-pre-line leading-relaxed">
                {entry.body}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit full log link */}
      <button
        className="inline-flex items-center gap-1 self-start type-micro text-muted-foreground hover:text-accent cursor-pointer bg-transparent border-none p-0 transition-colors"
        onClick={onEditFull}
      >
        <Pencil size={11} /> Edit full log
      </button>
    </div>
  )
}

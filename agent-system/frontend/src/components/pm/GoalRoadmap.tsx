import { useMemo, useRef, useState, useEffect } from 'react'
import { usePMStore } from '@/stores/pm-store.ts'
import type { Goal, TimelineEntry } from '@/stores/pm-store.ts'
import { parseGoalTarget } from '@/lib/date-utils.ts'
import { format, addDays } from 'date-fns'

// --- Constants ---

const ROW_HEIGHT = 28
const BAR_HEIGHT = 18
const LABEL_WIDTH = 200
const MIN_BAR_PX = 6
const HEADER_HEIGHT = 24
const GROUP_GAP = 8
const PADDING_FRAC = 0.05

// --- Scale ---

interface TimeScale {
  startMs: number
  endMs: number
  pxPerMs: number
}

function computeScale(goals: Goal[], chartWidth: number): TimeScale | null {
  let minMs = Infinity
  let maxMs = -Infinity

  for (const goal of goals) {
    const target = parseGoalTarget(goal.target).getTime()
    if (target > maxMs) maxMs = target

    for (const e of goal.timeline || []) {
      const s = new Date(e.earliest_start).getTime()
      const lf = new Date(e.latest_finish).getTime()
      if (s < minMs) minMs = s
      if (lf > maxMs) maxMs = lf
    }
  }

  const now = Date.now()
  if (now < minMs) minMs = now
  if (now > maxMs) maxMs = now

  if (!isFinite(minMs) || !isFinite(maxMs) || chartWidth <= 0) return null

  const range = maxMs - minMs || 86400000
  const pad = range * PADDING_FRAC
  const startMs = minMs - pad
  const endMs = maxMs + pad
  return { startMs, endMs, pxPerMs: chartWidth / (endMs - startMs) }
}

function toX(ms: number, s: TimeScale): number {
  return (ms - s.startMs) * s.pxPerMs
}

// --- Ticks ---

function generateTicks(scale: TimeScale): { x: number; label: string; minor: boolean }[] {
  const ticks: { x: number; label: string; minor: boolean }[] = []
  const rangeDays = (scale.endMs - scale.startMs) / 86400000

  if (rangeDays < 90) {
    // Weekly ticks
    const d = new Date(scale.startMs)
    d.setDate(d.getDate() - d.getDay() + 1)
    d.setHours(0, 0, 0, 0)
    const end = scale.endMs
    while (d.getTime() <= end) {
      const isFirst = d.getDate() <= 7
      ticks.push({ x: toX(d.getTime(), scale), label: isFirst ? format(d, 'MMM d') : format(d, 'd'), minor: !isFirst })
      const next = addDays(d, 7)
      d.setTime(next.getTime())
    }
  } else {
    // Monthly ticks
    const d = new Date(scale.startMs)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    const end = scale.endMs
    while (d.getTime() <= end) {
      ticks.push({ x: toX(d.getTime(), scale), label: format(d, 'MMM yyyy'), minor: false })
      d.setMonth(d.getMonth() + 1)
    }
  }

  return ticks
}

// --- Component ---

export function GoalRoadmap({ goalId }: { goalId?: string } = {}) {
  const state = usePMStore(s => s.state)
  const allGoals = state?.goals || []
  const goals = goalId ? allGoals.filter(g => g.id === goalId) : allGoals

  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(600)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth - LABEL_WIDTH
      if (w > 100) setChartWidth(w)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { scale, ticks, sections } = useMemo(() => {
    const scale = computeScale(goals, chartWidth)
    if (!scale) return { scale: null, ticks: [] as ReturnType<typeof generateTicks>, sections: [] as { goal: Goal; entries: TimelineEntry[]; critSet: Set<string>; targetMs: number }[] }
    return {
      scale,
      ticks: generateTicks(scale),
      sections: goals.map(goal => ({
        goal,
        entries: goal.timeline || [],
        critSet: new Set(goal.critical_path || []),
        targetMs: parseGoalTarget(goal.target).getTime(),
      })),
    }
  }, [goals, chartWidth])

  if (goals.length === 0 || !scale) {
    return <div className="text-muted-foreground type-body-sm py-6 text-center">No timeline data</div>
  }

  // Calculate SVG height
  let totalRows = 0
  for (const s of sections) totalRows += 1 + s.entries.length
  const svgHeight = HEADER_HEIGHT + totalRows * ROW_HEIGHT + sections.length * GROUP_GAP

  const todayX = toX(Date.now(), scale)

  return (
    <div ref={containerRef} className="border border-border rounded-md bg-[var(--bg-ingrained)] overflow-x-auto" style={{ maxHeight: 420 }}>
      <div className="flex" style={{ minWidth: LABEL_WIDTH + chartWidth }}>
        {/* Labels */}
        <div className="shrink-0 border-r border-border" style={{ width: LABEL_WIDTH }}>
          <div className="sticky top-0 bg-[var(--bg-surface)] border-b border-border type-caption font-medium text-muted-foreground px-2 flex items-center" style={{ height: HEADER_HEIGHT }}>
            Steps
          </div>
          {sections.map(({ goal, entries, critSet }) => (
            <div key={goal.id}>
              <div className="px-2 type-caption font-semibold text-foreground truncate flex items-center border-b border-border/30" style={{ height: ROW_HEIGHT, marginTop: GROUP_GAP }}>
                {goal.title}
              </div>
              {entries.map(entry => (
                <div key={entry.step_id} className="px-2 type-caption truncate flex items-center gap-1 border-b border-border/10 text-muted-foreground" style={{ height: ROW_HEIGHT }}>
                  {critSet.has(entry.step_id) && <span className="w-1.5 h-1.5 rounded-full bg-red shrink-0" />}
                  <span className="truncate">{entry.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1 min-w-0">
          <svg width={chartWidth} height={svgHeight} className="block">
            {/* Grid lines + header labels */}
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={t.x} y1={HEADER_HEIGHT} x2={t.x} y2={svgHeight} stroke="var(--color-border-subtle)" strokeWidth={0.5} strokeDasharray={t.minor ? '2 3' : undefined} />
                <text x={t.x + 3} y={HEADER_HEIGHT - 6} fill="var(--color-text-subtle)" fontSize={9}>{t.label}</text>
              </g>
            ))}

            {/* Today line */}
            <line x1={todayX} y1={0} x2={todayX} y2={svgHeight} stroke="var(--color-green)" strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={todayX + 3} y={11} fill="var(--color-green)" fontSize={9} fontWeight={600}>Today</text>

            {/* Bars per section */}
            {(() => {
              let y = HEADER_HEIGHT
              return sections.map(({ goal, entries, critSet, targetMs }) => {
                y += GROUP_GAP
                const sectionStartY = y
                y += ROW_HEIGHT // group header

                const targetX = toX(targetMs, scale)

                const bars = entries.map(entry => {
                  const esMs = new Date(entry.earliest_start).getTime()
                  const efMs = new Date(entry.earliest_finish).getTime()
                  const lfMs = new Date(entry.latest_finish).getTime()
                  const isCrit = critSet.has(entry.step_id)
                  const isDone = efMs <= esMs // 0-duration = completed
                  const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2
                  y += ROW_HEIGHT

                  // Full scheduling window: earliest_start → latest_finish
                  const windowX = toX(esMs, scale)
                  const windowEnd = toX(lfMs, scale)
                  const windowW = Math.max(MIN_BAR_PX, windowEnd - windowX)

                  // Work segment within: earliest_start → earliest_finish
                  const workW = Math.max(0, toX(efMs, scale) - windowX)

                  return (
                    <g key={entry.step_id}>
                      {/* Full scheduling window (faint) */}
                      <rect x={windowX} y={barY + 2} width={windowW} height={BAR_HEIGHT - 4} rx={3}
                        fill={isDone ? 'var(--color-text-subtle)' : isCrit ? 'var(--color-red)' : 'var(--color-accent)'}
                        opacity={isDone ? 0.12 : 0.2} />
                      {/* Work segment (solid) — only if there's actual duration */}
                      {workW > 2 && (
                        <rect x={windowX} y={barY} width={Math.max(MIN_BAR_PX, workW)} height={BAR_HEIGHT} rx={3}
                          fill={isCrit ? 'var(--color-red)' : 'var(--color-accent)'} opacity={0.85} />
                      )}
                      {/* Done marker — small filled dot for 0-duration tasks */}
                      {isDone && (
                        <circle cx={windowX + 3} cy={barY + BAR_HEIGHT / 2} r={3}
                          fill="var(--color-green)" opacity={0.7} />
                      )}
                    </g>
                  )
                })

                return (
                  <g key={goal.id}>
                    <line x1={targetX} y1={sectionStartY} x2={targetX} y2={y} stroke="var(--color-orange)" strokeWidth={1.5} strokeDasharray="3 2" />
                    <text x={targetX - 3} y={sectionStartY + 10} fill="var(--color-orange)" fontSize={8} textAnchor="end">target</text>
                    {bars}
                  </g>
                )
              })
            })()}
          </svg>
        </div>
      </div>
    </div>
  )
}

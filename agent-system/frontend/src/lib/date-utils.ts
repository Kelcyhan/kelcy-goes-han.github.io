/**
 * Parse goal target strings into Date objects.
 * Handles: YYYY-MM-DD, YYYY-MM-DDTHH:MM, "Spring 2026", "Q1 2026", "Ongoing", etc.
 */

const SEASON_MAP: Record<string, number[]> = {
  spring: [3, 15],  // Apr 15
  summer: [6, 15],  // Jul 15
  fall: [9, 15],    // Oct 15
  autumn: [9, 15],  // Oct 15
  winter: [0, 15],  // Jan 15
}

const QUARTER_END: Record<string, number[]> = {
  q1: [2, 31],  // Mar 31
  q2: [5, 30],  // Jun 30
  q3: [8, 30],  // Sep 30
  q4: [11, 31], // Dec 31
}

export function parseGoalTarget(target: string): Date {
  if (!target) return fallbackDate()

  // ISO date: YYYY-MM-DD or YYYY-MM-DDTHH:MM
  const isoMatch = target.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const d = new Date(target)
    if (!isNaN(d.getTime())) return d
  }

  const lower = target.toLowerCase().trim()

  // Season: "Spring 2026", "summer 2025"
  for (const [season, [month, day]] of Object.entries(SEASON_MAP)) {
    const m = lower.match(new RegExp(`${season}\\s+(\\d{4})`))
    if (m) return new Date(parseInt(m[1]), month, day)
  }

  // Quarter: "Q1 2026", "q3 2025"
  for (const [q, [month, day]] of Object.entries(QUARTER_END)) {
    const m = lower.match(new RegExp(`${q}\\s+(\\d{4})`))
    if (m) return new Date(parseInt(m[1]), month, day)
  }

  // "Ongoing" or "TBD" → 6 months from today
  if (lower === 'ongoing' || lower === 'tbd' || lower === 'none') {
    return fallbackDate()
  }

  // Bare year: "2026"
  const yearMatch = lower.match(/^(\d{4})$/)
  if (yearMatch) return new Date(parseInt(yearMatch[1]), 11, 31)

  return fallbackDate()
}

function fallbackDate(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + 6)
  return d
}

/**
 * Infer a goal's start date from timeline data, earliest task start, or 3 months before target.
 */
export function inferGoalStart(
  goal: {
    target: string
    sub?: { tasks?: { started?: string }[] }[]
    timeline?: { earliest_start: string }[]
    tagged_tasks?: unknown[]
  }
): Date {
  let earliest: Date | null = null

  // v4: use timeline earliest_start
  if (goal.timeline && goal.timeline.length > 0) {
    for (const entry of goal.timeline) {
      if (entry.earliest_start) {
        const d = new Date(entry.earliest_start)
        if (!isNaN(d.getTime()) && (!earliest || d < earliest)) {
          earliest = d
        }
      }
    }
    if (earliest) return earliest
  }

  // Legacy: check sub-goal tasks
  if (goal.sub) {
    for (const sub of goal.sub) {
      if (sub.tasks) {
        for (const task of sub.tasks) {
          if (task.started) {
            const d = new Date(task.started)
            if (!isNaN(d.getTime()) && (!earliest || d < earliest)) {
              earliest = d
            }
          }
        }
      }
    }
  }

  if (earliest) return earliest

  // Fallback: 3 months before target
  const target = parseGoalTarget(goal.target)
  const start = new Date(target)
  start.setMonth(start.getMonth() - 3)
  return start
}

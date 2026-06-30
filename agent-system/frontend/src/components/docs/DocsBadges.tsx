interface DocsBadgesProps {
  frontmatter: Record<string, unknown>
}

const statusClass: Record<string, string> = {
  done: 'bg-[rgba(59,184,122,0.12)] text-[var(--color-status-done)]',
  active: 'bg-[var(--color-accent-dim)] text-accent',
  proposed: 'bg-[rgba(212,146,42,0.12)] text-[var(--color-status-proposed)]',
  todo: 'bg-[var(--bg-raised)] text-muted-foreground',
  blocked: 'bg-[rgba(224,90,75,0.12)] text-[var(--color-status-blocked)]',
}

export function DocsBadges({ frontmatter }: DocsBadgesProps) {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return null

  const fm = frontmatter
  const badges: Array<{ label: string; className: string }> = []

  if (fm.status) {
    const cls = statusClass[String(fm.status)] || 'bg-[var(--bg-raised)] text-muted-foreground'
    badges.push({ label: String(fm.status), className: cls })
  }
  if (fm.type) {
    badges.push({ label: String(fm.type), className: 'bg-[var(--bg-raised)] text-muted-foreground' })
  }

  if (badges.length === 0 && !fm.id && !fm.updated && !fm.window) return null

  return (
    <div className="flex flex-wrap gap-1.5 mb-4 items-center">
      {badges.map((b, i) => (
        <span key={i} className={`inline-block type-micro px-2 py-0.5 rounded-full font-medium ${b.className}`}>{b.label}</span>
      ))}
      {fm.id != null && (
        <span className="inline-block type-micro px-2 py-0.5 rounded-full font-medium bg-[var(--bg-base)] text-accent font-mono">{String(fm.id)}</span>
      )}
      {fm.updated != null && (
        <span className="type-micro text-muted-foreground italic">{'updated ' + String(fm.updated)}</span>
      )}
      {fm.window != null && (
        <span className="type-micro text-muted-foreground italic">{String(fm.window)}</span>
      )}
    </div>
  )
}

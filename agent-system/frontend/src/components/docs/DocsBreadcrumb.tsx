interface DocsBreadcrumbProps {
  path: string | null
}

export function DocsBreadcrumb({ path }: DocsBreadcrumbProps) {
  if (!path) return null

  const parts = path.split('/')

  return (
    <div className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1
        return (
          <span key={i}>
            {i > 0 && <span className="mx-1 text-border">/</span>}
            <span className={isLast ? 'text-foreground font-medium' : 'cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-accent-foreground'}>{part}</span>
          </span>
        )
      })}
    </div>
  )
}

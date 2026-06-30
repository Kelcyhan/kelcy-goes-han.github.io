/**
 * JsonTree — lightweight collapsible JSON viewer. Zero external dependencies.
 * Replaces @uiw/react-json-view which crashes on React 19 (alpha build).
 */
import { useState } from 'react'

function JsonValue({ value, depth }: { value: unknown; depth: number }) {
  if (value === null) return <span className="text-[var(--color-text-muted)]">null</span>
  if (value === undefined) return <span className="text-[var(--color-text-muted)]">undefined</span>
  if (typeof value === 'boolean') return <span className="text-[#c678dd]">{String(value)}</span>
  if (typeof value === 'number') return <span className="text-[#d19a66]">{String(value)}</span>
  if (typeof value === 'string') return <span className="text-[#98c379]">"{value}"</span>
  if (Array.isArray(value)) return <JsonArray items={value} depth={depth} />
  if (typeof value === 'object') return <JsonObject data={value as Record<string, unknown>} depth={depth} />
  return <span>{String(value)}</span>
}

function JsonObject({ data, depth }: { data: Record<string, unknown>; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const entries = Object.entries(data)

  if (entries.length === 0) return <span className="text-[var(--color-text-muted)]">{'{}'}</span>

  if (!open) {
    return (
      <span>
        <button
          onClick={() => setOpen(true)}
          className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-0 text-inherit font-inherit hover:text-[var(--color-accent)]"
        >
          {'{'} <span className="type-micro">{entries.length} keys</span> {'}'}
        </button>
      </span>
    )
  }

  return (
    <span>
      <button
        onClick={() => setOpen(false)}
        className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-0 text-inherit font-inherit hover:text-[var(--color-accent)]"
      >
        {'{'}
      </button>
      <div className="pl-4 border-l border-[var(--color-border-subtle)] ml-1">
        {entries.map(([key, val], i) => (
          <div key={key} className="leading-relaxed">
            <span className="text-[#61afef]">"{key}"</span>
            <span className="text-[var(--color-text-muted)]">: </span>
            <JsonValue value={val} depth={depth + 1} />
            {i < entries.length - 1 && <span className="text-[var(--color-text-muted)]">,</span>}
          </div>
        ))}
      </div>
      <span className="text-[var(--color-text-muted)]">{'}'}</span>
    </span>
  )
}

function JsonArray({ items, depth }: { items: unknown[]; depth: number }) {
  const [open, setOpen] = useState(depth < 2)

  if (items.length === 0) return <span className="text-[var(--color-text-muted)]">[]</span>

  if (!open) {
    return (
      <span>
        <button
          onClick={() => setOpen(true)}
          className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-0 text-inherit font-inherit hover:text-[var(--color-accent)]"
        >
          [ <span className="type-micro">{items.length} items</span> ]
        </button>
      </span>
    )
  }

  return (
    <span>
      <button
        onClick={() => setOpen(false)}
        className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-0 text-inherit font-inherit hover:text-[var(--color-accent)]"
      >
        [
      </button>
      <div className="pl-4 border-l border-[var(--color-border-subtle)] ml-1">
        {items.map((item, i) => (
          <div key={i} className="leading-relaxed">
            <JsonValue value={item} depth={depth + 1} />
            {i < items.length - 1 && <span className="text-[var(--color-text-muted)]">,</span>}
          </div>
        ))}
      </div>
      <span className="text-[var(--color-text-muted)]">]</span>
    </span>
  )
}

interface JsonTreeProps {
  data: unknown
}

export function JsonTree({ data }: JsonTreeProps) {
  return (
    <div className="p-3 type-body-sm font-mono">
      <JsonValue value={data} depth={0} />
    </div>
  )
}

/**
 * MarkdownPreview — Lightweight read-only markdown renderer.
 *
 * Uses react-markdown (already in bundle) instead of CodeMirror.
 * Supports an `inline` prop for compact rendering (single-line done-when items).
 */
import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownPreviewProps {
  value: string
  inline?: boolean
}

export const MarkdownPreview = memo(function MarkdownPreview({ value, inline }: MarkdownPreviewProps) {
  if (!value) return null

  if (inline) {
    return (
      <span className="inline [&_p]:inline [&_p]:m-0 text-inherit leading-inherit [&_code]:bg-[var(--bg-tertiary)] [&_code]:px-1 [&_code]:rounded [&_code]:text-[0.9em] [&_a]:text-[var(--accent)]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      </span>
    )
  }

  return (
    <div className="leading-relaxed type-body-sm prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-medium [&_code]:bg-[var(--bg-tertiary)] [&_code]:px-1 [&_code]:rounded [&_code]:text-[0.9em] [&_pre]:bg-[var(--bg-tertiary)] [&_pre]:rounded-md [&_pre]:p-3 [&_a]:text-[var(--accent)] [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_table]:border-collapse [&_th]:border [&_th]:border-[var(--border)] [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:bg-[var(--bg-raised)] [&_th]:font-semibold [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-2.5 [&_td]:py-1.5 [&_hr]:border-[var(--border)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  )
})

import { useMemo, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkWikiLink from 'remark-wiki-link'
import { useVaultIndexStore } from '@/stores/vault-index-store.ts'
import { createDvApi, outputsToMarkdown, type VaultPage, type DvOutput } from '@/lib/dataview.ts'

interface DataviewBlockProps {
  /** The raw DataviewJS source code from the code fence. */
  code: string
  /** The current file's frontmatter — used for dv.current(). */
  frontmatter: Record<string, unknown>
  /** The current file's vault-relative path. */
  filePath: string
  /** Called when a wikilink is clicked. */
  onNavigate: (target: string) => void
}

/**
 * Executes a DataviewJS block and renders its output as markdown.
 *
 * Security note: executes arbitrary JS from the vault via new Function().
 * This is intentional — the vault is trusted content authored by the user.
 * The dv API surface is read-only (no DOM access, no network, pure data).
 */
export function DataviewBlock({ code, frontmatter, filePath, onNavigate }: DataviewBlockProps) {
  const { pages, loaded, loading, fetchPages } = useVaultIndexStore()

  // Ensure the page index is loaded
  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  const { markdown, error } = useMemo(() => {
    if (!loaded && !loading) return { markdown: '', error: null }
    if (loading && pages.length === 0) return { markdown: '', error: null }

    // Build currentPage from frontmatter + file info
    const stem = filePath.split('/').pop()?.replace(/\.md$/, '') ?? ''
    const currentPage: VaultPage = {
      id: String(frontmatter.id ?? ''),
      title: String(frontmatter.title ?? stem),
      status: String(frontmatter.status ?? ''),
      parent: String(frontmatter.parent ?? ''),
      project_id: String(frontmatter.project_id ?? ''),
      file: { name: stem, path: filePath, link: stem },
      ...frontmatter,
    }

    const { dv, outputs } = createDvApi(currentPage, pages)

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('dv', code)
      fn(dv)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const errOutput: DvOutput = { type: 'error', message: msg }
      return { markdown: outputsToMarkdown([errOutput]), error: msg }
    }

    return { markdown: outputsToMarkdown(outputs), error: null }
  }, [code, frontmatter, filePath, pages, loaded, loading])

  if (loading && pages.length === 0) {
    return <span className="dataview-loading">⟳ loading index…</span>
  }

  if (!markdown) return null

  return (
    <div className={`dataview-output${error ? ' dataview-error' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          [remarkWikiLink, {
            aliasDivider: '|',
            hrefTemplate: (permalink: string) => `#wiki:${permalink}`,
            wikiLinkClassName: 'wikilink',
            pageResolver: (name: string) => [name],
          }],
        ]}
        components={{
          a: ({ href, children, className, ...props }) => {
            if (className === 'wikilink' || href?.startsWith('#wiki:')) {
              const target = href?.replace('#wiki:', '') || ''
              return (
                <a
                  href="#"
                  className="wikilink"
                  onClick={e => { e.preventDefault(); onNavigate(target) }}
                  {...props}
                >{children}</a>
              )
            }
            return <a href={href} target="_blank" rel="noopener" {...props}>{children}</a>
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

import { useMemo, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkWikiLink from 'remark-wiki-link'
import { useVaultIndexStore } from '@/stores/vault-index-store.ts'
import { executeDql } from '@/lib/dataview-dql.ts'
import type { VaultPage } from '@/lib/dataview.ts'

interface DataviewDqlBlockProps {
  code: string
  frontmatter: Record<string, unknown>
  filePath: string
  onNavigate: (target: string) => void
}

export function DataviewDqlBlock({ code, frontmatter, filePath, onNavigate }: DataviewDqlBlockProps) {
  const { pages, loaded, loading, fetchPages } = useVaultIndexStore()

  useEffect(() => { fetchPages() }, [fetchPages])

  const { markdown, error } = useMemo(() => {
    if (loading && pages.length === 0) return { markdown: '', error: null }

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

    return executeDql(code, currentPage, pages)
  }, [code, frontmatter, filePath, pages, loaded, loading])

  if (loading && pages.length === 0) {
    return <span className="dataview-loading">⟳ loading…</span>
  }
  if (!markdown && !error) return null

  return (
    <div className={`dataview-output${error ? ' dataview-error' : ''}`}>
      {error
        ? <blockquote>⚠️ DQL error: {error}</blockquote>
        : (
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
                    <a href="#" className="wikilink"
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
        )
      }
    </div>
  )
}

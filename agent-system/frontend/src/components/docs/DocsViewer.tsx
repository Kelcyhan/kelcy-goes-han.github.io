import { useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkWikiLink from 'remark-wiki-link'
import { useDocsStore } from '@/stores/docs-store.ts'
import { DocsBreadcrumb } from '@/components/docs/DocsBreadcrumb.tsx'
import { DocsBadges } from '@/components/docs/DocsBadges.tsx'

export function DocsViewer() {
  const { currentPath, currentFile, loading, error, loadFile, goBack, history, navigateWikilink } = useDocsStore()

  // Load default briefing if nothing loaded
  useEffect(() => {
    if (!currentPath) {
      loadFile('State/briefings/current.md')
    }
  }, [currentPath, loadFile])

  const handleWikilinkClick = useCallback(
    (target: string) => {
      navigateWikilink(target)
    },
    [navigateWikilink],
  )

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-1.5 border-b border-[var(--color-border-subtle)] bg-[var(--bg-surface)] shrink-0">
        {history.length > 0 && (
          <button onClick={goBack} className="bg-transparent border border-border text-muted-foreground px-2 py-0.5 rounded-sm cursor-pointer type-body-sm transition-colors duration-200 hover:border-accent hover:text-accent-foreground">&larr;</button>
        )}
        <DocsBreadcrumb path={currentPath} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-7 py-5 leading-relaxed">
        {loading && <div className="text-muted-foreground text-sm py-10 text-center">Loading...</div>}
        {error && <div className="text-red text-sm px-5 py-10 text-center">{error}</div>}
        {currentFile && !loading && !error && (
          <>
            <DocsBadges frontmatter={currentFile.frontmatter} />
            <div className="doc-body">
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
                          onClick={e => { e.preventDefault(); handleWikilinkClick(target) }}
                          {...props}
                        >
                          {children}
                        </a>
                      )
                    }
                    return <a href={href} {...props}>{children}</a>
                  },
                  input: ({ type, checked, ...props }) => {
                    if (type === 'checkbox') {
                      return (
                        <span className={`doc-checkbox ${checked ? 'cb-done' : 'cb-todo'}`}>
                          {checked ? '\u2611' : '\u2610'}
                          <input type="checkbox" checked={checked} readOnly style={{ display: 'none' }} {...props} />
                        </span>
                      )
                    }
                    return <input type={type} checked={checked} {...props} />
                  },
                }}
              >
                {currentFile.body}
              </ReactMarkdown>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

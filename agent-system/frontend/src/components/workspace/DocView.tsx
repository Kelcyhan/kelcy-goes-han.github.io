import { useCallback, useEffect, useRef, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkWikiLink from 'remark-wiki-link'
import { useTabStore } from '@/stores/tab-store.ts'
import type { DocTabData } from '@/stores/tab-store.ts'
import { DocsBadges } from '@/components/docs/DocsBadges.tsx'
import { MarkdownEditor } from '@/components/workspace/MarkdownEditor.tsx'
import { UniversalFileViewer } from '@/components/workspace/UniversalFileViewer.tsx'
import React from 'react'
import { DataviewBlock } from '@/components/workspace/DataviewBlock.tsx'
import { resolveWikilink, vaultPreviewUrl } from '@/lib/api.ts'
import { isVaultPath, resolveHref } from '@/lib/doc-links.ts'
import { isClickableCode, isTaskRef, isSessionName } from '@/lib/clickable-code.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { useFileResolve } from '@/lib/use-file-resolve.tsx'
import { ActionButton, IconButton, Text, Toolbar, ToolbarGroup } from '@/components/primitives'
import { ArrowLeft, ArrowRight, Pencil } from 'lucide-react'

const LazyCollaboraViewer = React.lazy(() => import('./viewers/CollaboraViewer.tsx'))
const LazyDiagramEditor = React.lazy(() => import('./viewers/DiagramEditor.tsx'))
const LazySVGEditor = React.lazy(() => import('./viewers/SVGEditor.tsx'))

interface DocViewProps {
  panelId: string
  tab: DocTabData
}

export function DocView({ panelId, tab }: DocViewProps) {
  const navigateDoc = useTabStore(s => s.navigateDoc)
  const openDocTab = useTabStore(s => s.openDocTab)
  const enterEditMode = useTabStore(s => s.enterEditMode)
  const exitEditMode = useTabStore(s => s.exitEditMode)
  const setEditContent = useTabStore(s => s.setEditContent)
  const saveDoc = useTabStore(s => s.saveDoc)
  const setDocScroll = useTabStore(s => s.setDocScroll)
  const goBack = useTabStore(s => s.goBack)
  const goForward = useTabStore(s => s.goForward)
  const canBack = tab.history.length > 0 || !!tab.sourceTabId
  const canFwd = tab.future.length > 0
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { resolve, PopupEl } = useFileResolve((filePath) => {
    navigateDoc(panelId, filePath)
  })

  const handleLink = useCallback((path: string, e: React.MouseEvent) => {
    e.preventDefault()
    const resolved = resolveHref(path, tab.currentPath)
    if (e.ctrlKey || e.metaKey) {
      openDocTab(resolved, true)
    } else {
      resolve(resolved, e)
    }
  }, [resolve, navigateDoc, openDocTab, panelId, tab.currentPath])

  const handleWikilink = useCallback((target: string, e: React.MouseEvent) => {
    e.preventDefault()
    const hashIdx = target.indexOf('#')
    const linkTarget = hashIdx >= 0 ? target.substring(0, hashIdx) : target
    if (!linkTarget) return
    const newTab = e.ctrlKey || e.metaKey
    const go = (path: string) => newTab ? openDocTab(path, true) : navigateDoc(panelId, path)
    if (/^[\w.\-/]+\.md$/.test(linkTarget)) {
      go(resolveHref(linkTarget, tab.currentPath))
      return
    }
    resolveWikilink(linkTarget).then(({ path }) => go(path)).catch(() => go(linkTarget))
  }, [navigateDoc, openDocTab, panelId, tab.currentPath])

  const handleInlineCode = useCallback(async (text: string, e: React.MouseEvent) => {
    e.preventDefault()
    const newTab = e.ctrlKey || e.metaKey
    if (isSessionName(text)) {
      useSessionStore.getState().setActiveSession(text)
      return
    }
    const taskId = isTaskRef(text)
    if (taskId) {
      const { usePMStore } = await import('@/stores/pm-store.ts')
      await usePMStore.getState().navigateTo(taskId)
      return
    }
    if (isVaultPath(text)) {
      const resolved = resolveHref(text, tab.currentPath)
      if (newTab) {
        openDocTab(resolved, true)
      } else {
        resolve(resolved, e)
      }
    }
  }, [resolve, navigateDoc, openDocTab, panelId, tab.currentPath])

  // Restore scroll position when content finishes loading
  const prevLoadingRef = useRef(tab.loading)
  useEffect(() => {
    const wasLoading = prevLoadingRef.current
    prevLoadingRef.current = tab.loading
    if (wasLoading && !tab.loading && tab.scrollTop && scrollRef.current) {
      const target = tab.scrollTop
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = target
      })
    }
  }, [tab.loading, tab.scrollTop])

  const handleDocScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current)
    scrollSaveTimer.current = setTimeout(() => {
      setDocScroll(panelId, el.scrollTop)
    }, 300)
  }, [panelId, setDocScroll])

  const handleSave = useCallback(async () => {
    try {
      await saveDoc(panelId)
    } catch (err) {
      console.error('Save failed:', err)
    }
  }, [saveDoc, panelId])

  // Office files: full-bleed Collabora iframe (no path bar, no padding)
  if (/\.(docx|xlsx|pptx|doc|xls|ppt|odt|ods|odp|rtf)$/i.test(tab.currentPath)) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Suspense fallback={<div className="text-muted-foreground text-sm py-10 text-center">Loading editor...</div>}>
          <LazyCollaboraViewer path={tab.currentPath} />
        </Suspense>
      </div>
    )
  }

  // Diagram files: full-bleed draw.io editor (no path bar, no padding)
  if (/\.drawio$/i.test(tab.currentPath)) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Suspense fallback={<div className="text-muted-foreground text-sm py-10 text-center">Loading diagram editor...</div>}>
          <LazyDiagramEditor path={tab.currentPath} />
        </Suspense>
      </div>
    )
  }

  // SVG files: full-bleed SVG-Edit editor
  if (/\.svg$/i.test(tab.currentPath)) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Suspense fallback={<div className="text-muted-foreground text-sm py-10 text-center">Loading SVG editor...</div>}>
          <LazySVGEditor path={tab.currentPath} />
        </Suspense>
      </div>
    )
  }

  const navButtons = (
    <ToolbarGroup className="gap-px">
      <IconButton
        variant="toolbar"
        size="xs"
        onClick={() => goBack(panelId)}
        disabled={!canBack}
        title="Back"
        aria-label="Back"
      >
        <ArrowLeft size={13} />
      </IconButton>
      <IconButton
        variant="toolbar"
        size="xs"
        onClick={() => goForward(panelId)}
        disabled={!canFwd}
        title="Forward"
        aria-label="Forward"
      >
        <ArrowRight size={13} />
      </IconButton>
    </ToolbarGroup>
  )

  // Non-markdown files: use UniversalFileViewer
  if (!tab.currentPath.endsWith('.md')) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        <Toolbar>
          {navButtons}
          <Text variant="micro" tone="muted" font="mono" truncate className="flex-1 whitespace-nowrap">{tab.currentPath}</Text>
        </Toolbar>
        <div className="flex-1 overflow-y-auto p-4">
          <UniversalFileViewer path={tab.currentPath} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {PopupEl}
      {/* Toolbar */}
      <Toolbar>
        {navButtons}
        <Text variant="micro" tone="muted" font="mono" truncate className="flex-1 whitespace-nowrap">{tab.currentPath}</Text>
        <ToolbarGroup>
          {tab.editMode ? (
            <>
              {tab.isDirty && <span className="inline-block w-[7px] h-[7px] rounded-full bg-orange" title="Unsaved changes" />}
              <ActionButton
                variant="toolbarPrimary"
                size="toolbar"
                onClick={handleSave}
                disabled={tab.saving || !tab.isDirty}
                title="Save (Ctrl+S)"
              >
                {tab.saving ? 'Saving…' : 'Save'}
              </ActionButton>
              <ActionButton
                variant="toolbar"
                size="toolbar"
                onClick={() => exitEditMode(panelId)}
                disabled={tab.saving}
                title="Discard changes"
              >
                Cancel
              </ActionButton>
            </>
          ) : (
            <ActionButton
              variant="toolbar"
              size="toolbar"
              onClick={() => enterEditMode(panelId)}
              disabled={!tab.content || tab.loading}
              title="Edit file"
            >
              <Pencil size={12} /> Edit
            </ActionButton>
          )}
        </ToolbarGroup>
      </Toolbar>

      {tab.loading && <div className="text-muted-foreground text-sm py-10 text-center">Loading…</div>}
      {tab.error && <div className="text-red text-sm px-5 py-10 text-center">{tab.error}</div>}

      {/* Edit mode — Milkdown editor */}
      {tab.editMode && tab.editContent !== null && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          <MarkdownEditor
            key={panelId + tab.currentPath}
            value={tab.editContent}
            onChange={(md) => setEditContent(panelId, md)}
            onSave={handleSave}
          />
        </div>
      )}

      {/* View mode — rendered markdown */}
      {!tab.editMode && tab.content && !tab.loading && !tab.error && (
        <div ref={scrollRef} onScroll={handleDocScroll} className="flex-1 overflow-y-auto px-7 py-5 leading-relaxed">
          <DocsBadges frontmatter={tab.content.frontmatter} />
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
              // Pass all URLs through unchanged — the img/a component overrides below
              // decide whether to rewrite them. Without this, react-markdown's default
              // urlTransform strips data: URIs (rendering inline base64 images as empty src).
              urlTransform={(url) => url}
              components={{
                code: ({ className, children, ...props }) => {
                  const lang = className?.replace('language-', '') ?? ''
                  const noopNav = (target: string) => handleWikilink(target, { preventDefault: () => {} } as React.MouseEvent)
                  if (lang === 'dataviewjs' && tab.content) {
                    return (
                      <DataviewBlock
                        code={String(children).replace(/\n$/, '')}
                        frontmatter={tab.content.frontmatter}
                        filePath={tab.currentPath}
                        onNavigate={noopNav}
                      />
                    )
                  }
                  // Inline code (no language class): make clickable if it looks like a path/task/session
                  if (!className) {
                    const text = String(children).trim()
                    if (isClickableCode(text)) {
                      return (
                        <code
                          className="clickable-code"
                          onClick={e => handleInlineCode(text, e as React.MouseEvent)}
                          title={text}
                          {...props}
                        >{children}</code>
                      )
                    }
                  }
                  return (
                    <code className={className} {...props}>{children}</code>
                  )
                },
                blockquote: ({ children }) => {
                  const kids = React.Children.toArray(children)
                  const first = kids[0]
                  if (React.isValidElement(first) && first.type === 'p') {
                    const pKids = React.Children.toArray((first.props as { children: React.ReactNode }).children)
                    const firstText = pKids[0]
                    if (typeof firstText === 'string') {
                      const m = firstText.match(/^\[!(\w+)\]\s*/)
                      if (m) {
                        const type = m[1].toLowerCase()
                        const stripped = firstText.slice(m[0].length)
                        const restPKids = stripped ? [stripped, ...pKids.slice(1)] : pKids.slice(1)
                        return (
                          <div className={`callout callout-${type}`}>
                            <span className="callout-type">{type}</span>
                            <span className="callout-body">{restPKids}{kids.slice(1)}</span>
                          </div>
                        )
                      }
                    }
                  }
                  return <blockquote>{children}</blockquote>
                },
                a: ({ href, children, className, ...props }) => {
                  if (className === 'wikilink' || href?.startsWith('#wiki:')) {
                    const target = href?.replace('#wiki:', '') || ''
                    return (
                      <a
                        href="#"
                        className="wikilink"
                        onClick={e => handleWikilink(target, e as React.MouseEvent)}
                        {...props}
                      >{children}</a>
                    )
                  }
                  // File link (with optional #anchor — strip it for navigation)
                  const hrefBase = href?.split('#')[0] ?? ''
                  if (href && (isVaultPath(hrefBase) || (hrefBase && isVaultPath(hrefBase)))) {
                    return (
                      <a
                        href="#"
                        className="file-link"
                        onClick={e => handleLink(hrefBase, e as React.MouseEvent)}
                        {...props}
                      >📄 {children}</a>
                    )
                  }
                  // Same-page anchor — let browser handle (no new tab)
                  if (href?.startsWith('#')) {
                    return <a href={href} {...props}>{children}</a>
                  }
                  return <a href={href} target="_blank" rel="noopener" {...props}>{children}</a>
                },
                input: ({ type, checked, ...props }) => {
                  if (type === 'checkbox') {
                    return (
                      <span className={`doc-checkbox ${checked ? 'cb-done' : 'cb-todo'}`}>
                        {checked ? '☑' : '☐'}
                        <input type="checkbox" checked={checked} readOnly style={{ display: 'none' }} {...props} />
                      </span>
                    )
                  }
                  return <input type={type} checked={checked} {...props} />
                },
                img: ({ src, alt, ...props }) => {
                  // Pass through data: URIs, http(s) URLs, and already-routed /api/ paths.
                  // For everything else (relative or vault-rooted paths), resolve through
                  // the vault preview endpoint so the image can be served with auth.
                  const rawSrc = typeof src === 'string' ? src : ''
                  let resolved = rawSrc
                  if (rawSrc && !/^(data:|https?:|blob:|\/api\/)/.test(rawSrc)) {
                    const vaultPath = resolveHref(rawSrc, tab.currentPath)
                    resolved = vaultPreviewUrl(vaultPath)
                  }
                  return <img src={resolved} alt={alt ?? ''} loading="lazy" {...props} />
                },
              }}
            >
              {tab.content.body}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, RefreshCw, FileText, Folder, Pencil, Eye, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { usePMStore } from '@/stores/pm-store.ts'
import { useTabStore } from '@/stores/tab-store.ts'
import { ActionButton } from '@/components/primitives'
import { MarkdownEditor } from '@/components/workspace/MarkdownEditor.tsx'
import { UniversalFileViewer } from '@/components/workspace/UniversalFileViewer.tsx'
import type { DirEntry } from './shared.tsx'
import * as api from '@/lib/api.ts'
import { isVaultPath, resolveHref } from '@/lib/doc-links.ts'
import { isClickableCode, isTaskRef, isSessionName } from '@/lib/clickable-code.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { useFileResolve } from '@/lib/use-file-resolve.tsx'
import React from 'react'

function FolderListing({ path }: { path: string }) {
  const navigateFilePreview = usePMStore(s => s.navigateFilePreview)
  const sseRefreshCounter = usePMStore(s => s.sseRefreshCounter)
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Re-fetch when SSE signals external file changes
  useEffect(() => {
    if (sseRefreshCounter > 0) setRefreshKey(k => k + 1)
  }, [sseRefreshCounter])

  useEffect(() => {
    setLoading(true)
    api.fetchVaultDirectory(path)
      .then(data => {
        setEntries(data.entries)
        setLoading(false)
      })
      .catch(() => {
        setEntries([])
        setLoading(false)
      })
  }, [path, refreshKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
        <RefreshCw size={16} className="animate-spin" />
      </div>
    )
  }

  if (entries.length === 0) {
    return <div className="text-muted-foreground type-micro">(empty directory)</div>
  }

  return (
    <div className="flex flex-col gap-0.5">
      {entries.map(entry => (
        <button
          key={entry.name}
          className="flex items-center gap-2 px-2.5 py-1.5 border-none rounded-sm bg-transparent text-foreground type-body-sm cursor-pointer text-left transition-colors duration-150 hover:bg-[var(--bg-card-hover)]"
          onClick={() => {
            const entryPath = path ? `${path}/${entry.name}` : entry.name
            navigateFilePreview(
              entryPath,
              entry.name,
              entry.type === 'dir' ? 'folder' : 'file',
            )
          }}
        >
          {entry.type === 'dir'
            ? <Folder size={14} className="text-muted-foreground" />
            : <FileText size={14} className="text-muted-foreground" />}
          <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{entry.name}</span>
          {entry.type === 'dir' && entry.count != null && (
            <span className="text-muted-foreground type-micro">({entry.count} items)</span>
          )}
        </button>
      ))}
    </div>
  )
}

function MarkdownContent({ path }: { path: string }) {
  const [rawContent, setRawContent] = useState<string | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const navigateFilePreview = usePMStore(s => s.navigateFilePreview)

  const { resolve, PopupEl } = useFileResolve((filePath) => {
    const name = filePath.split('/').pop() || filePath
    navigateFilePreview(filePath, name, 'file')
  })

  const handleLink = useCallback((href: string, e: React.MouseEvent) => {
    e.preventDefault()
    const resolved = resolveHref(href, path)
    resolve(resolved, e)
  }, [path, resolve])

  const handleInlineCode = useCallback(async (text: string, e: React.MouseEvent) => {
    e.preventDefault()
    if (isSessionName(text)) {
      useSessionStore.getState().setActiveSession(text)
      return
    }
    const taskId = isTaskRef(text)
    if (taskId) {
      const { usePMStore: pmStore } = await import('@/stores/pm-store.ts')
      await pmStore.getState().navigateTo(taskId)
      return
    }
    if (isVaultPath(text)) {
      const resolved = resolveHref(text, path)
      resolve(resolved, e)
    }
  }, [path, resolve])

  useEffect(() => {
    setLoading(true)
    setEditing(false)
    api.fetchVaultFile(path)
      .then(data => {
        setBody(data.body || '')
        if (data.frontmatter && Object.keys(data.frontmatter).length > 0) {
          const yaml = Object.entries(data.frontmatter)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join('\n')
          setRawContent(`---\n${yaml}\n---\n${data.body || ''}`)
        } else {
          setRawContent(data.body || '')
        }
        setLoading(false)
      })
      .catch(() => {
        setBody('Failed to load file.')
        setRawContent('Failed to load file.')
        setLoading(false)
      })
  }, [path])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
        <RefreshCw size={16} className="animate-spin" />
      </div>
    )
  }

  if (body == null) return null

  const handleSave = async () => {
    try {
      await api.saveVaultFile(path, rawContent || '')
    } catch (err) {
      console.error('Failed to save:', err)
    }
  }

  const toggleBtnBase = "inline-flex items-center gap-[3px] px-2 py-[3px] rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground transition-all duration-150 hover:border-[var(--color-accent)] hover:text-accent-foreground"
  const toggleBtnActive = "border-[var(--color-accent)] text-accent-foreground bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"

  return (
    <div className="flex flex-col gap-2">
      {PopupEl}
      <div className="flex gap-1">
        <button
          className={`${toggleBtnBase} ${!editing ? toggleBtnActive : ''}`}
          onClick={() => setEditing(false)}
        >
          <Eye size={12} /> View
        </button>
        <button
          className={`${toggleBtnBase} ${editing ? toggleBtnActive : ''}`}
          onClick={() => setEditing(true)}
        >
          <Pencil size={12} /> Edit
        </button>
      </div>
      {editing ? (
        <div className="h-[calc(100vh-340px)] overflow-auto [&_.markdown-editor-wrap]:h-full">
          <MarkdownEditor
            value={rawContent || ''}
            onChange={(v) => setRawContent(v)}
            onSave={handleSave}
          />
        </div>
      ) : (
        <div className="doc-body type-body-sm leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            // Pass all URLs through unchanged so data: URIs reach the img override
            urlTransform={(url) => url}
            components={{
              img: ({ src, alt, ...props }) => {
                // Pass through data: URIs, http(s) URLs, and already-routed /api/ paths.
                // Resolve relative paths through the vault preview endpoint.
                const rawSrc = typeof src === 'string' ? src : ''
                let resolved = rawSrc
                if (rawSrc && !/^(data:|https?:|blob:|\/api\/)/.test(rawSrc)) {
                  const vaultPath = resolveHref(rawSrc, path)
                  resolved = api.vaultPreviewUrl(vaultPath)
                }
                return <img src={resolved} alt={alt ?? ''} loading="lazy" {...props} />
              },
              a: ({ href, children, ...props }) => {
                const hrefBase = href?.split('#')[0] ?? ''
                if (href && isVaultPath(hrefBase)) {
                  return (
                    <a href="#" className="file-link" onClick={e => handleLink(hrefBase, e as React.MouseEvent)} {...props}>
                      📄 {children}
                    </a>
                  )
                }
                if (href?.startsWith('#')) {
                  return <a href={href} {...props}>{children}</a>
                }
                return <a href={href} target="_blank" rel="noopener" {...props}>{children}</a>
              },
              code: ({ className, children, ...props }) => {
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
                return <code className={className} {...props}>{children}</code>
              }
            }}
          >{body}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

const OFFICE_RE = /\.(docx|xlsx|pptx|doc|xls|ppt|odt|ods|odp|rtf)$/i

function FileContent({ path }: { path: string }) {
  if (path.endsWith('.md')) {
    return <MarkdownContent path={path} />
  }
  // Office files: show prompt to open in workspace tab (too heavy for inline preview)
  if (OFFICE_RE.test(path)) {
    const name = path.split('/').pop() || 'file'
    return <OfficeFileCard name={name} path={path} />
  }
  return <UniversalFileViewer path={path} />
}

function OfficeFileCard({ name, path }: { name: string; path: string }) {
  const openDocTab = useTabStore(s => s.openDocTab)
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-muted-foreground">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="text-sm font-medium text-foreground">{name}</span>
      <span className="text-xs">Office document — opens in Collabora Online editor</span>
      <button
        onClick={() => openDocTab(path)}
        className="inline-flex items-center gap-1.5 mt-1 px-4 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
      >
        Open in tab
      </button>
    </div>
  )
}

export function FilePreview() {
  const filePreview = usePMStore(s => s.filePreview)
  const navigateFileBack = usePMStore(s => s.navigateFileBack)

  if (!filePreview) return null

  const { path, type, name } = filePreview

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ActionButton variant="back" className="self-start shrink-0" onClick={navigateFileBack}>
          <ArrowLeft size={14} /> Back
        </ActionButton>
        <div className="min-w-0 flex-1">
          <div className="truncate type-body-sm font-medium text-foreground">{name}</div>
          <div className="type-micro text-muted-foreground">
            {type === 'folder' ? '\uD83D\uDCC1' : '\uD83D\uDCC4'} {path}
          </div>
        </div>
        {type === 'file' && (
          <ActionButton
            variant="panel"
            size="sm"
            className="shrink-0 gap-1"
            onClick={() => {
              const store = useTabStore.getState()
              if (path.endsWith('.tex')) {
                store.openLatexTab(path)
              } else {
                store.openDocTab(path)
              }
            }}
            title="Open in workspace tab"
          >
            <ExternalLink size={11} />
            {path.endsWith('.tex') ? 'Open in LaTeX editor' : 'Open in tab'}
          </ActionButton>
        )}
      </div>
      <div className="bg-card border border-border rounded-md p-4 overflow-auto max-h-[calc(100vh-300px)]">
        {type === 'folder'
          ? <FolderListing path={path} />
          : <FileContent path={path} />}
      </div>
    </div>
  )
}

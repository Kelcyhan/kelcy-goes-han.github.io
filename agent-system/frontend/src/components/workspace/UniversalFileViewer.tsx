/**
 * UniversalFileViewer — dispatches to format-specific renderers by file extension.
 *
 * Used in both FilePreview (PM panel) and DocView (workspace tabs).
 * All non-trivial renderers are React.lazy() loaded for bundle splitting.
 */
import React, { Suspense, useEffect, useState } from 'react'
import { RefreshCw, Download, FileQuestion } from 'lucide-react'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'
import { Text } from '@/components/primitives'

// ---------------------------------------------------------------------------
// Lazy-loaded sub-viewers
// ---------------------------------------------------------------------------

const LazyCodeViewer = React.lazy(() => import('./viewers/CodeViewer.tsx'))
const LazyJsonViewer = React.lazy(() => import('./viewers/JsonViewer.tsx'))
const LazyCsvViewer = React.lazy(() => import('./viewers/CsvViewer.tsx'))
const LazyYamlViewer = React.lazy(() => import('./viewers/YamlViewer.tsx'))
const LazyCollaboraViewer = React.lazy(() => import('./viewers/CollaboraViewer.tsx'))
const LazyDiagramEditor = React.lazy(() => import('./viewers/DiagramEditor.tsx'))
const LazySVGEditor = React.lazy(() => import('./viewers/SVGEditor.tsx'))

// ---------------------------------------------------------------------------
// Extension classification
// ---------------------------------------------------------------------------

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'])
const SVG_EDIT_EXTS = new Set(['.svg'])
const PDF_EXTS = new Set(['.pdf'])
const JSON_EXTS = new Set(['.json'])
const CSV_EXTS = new Set(['.csv'])
const YAML_EXTS = new Set(['.yaml', '.yml'])
const OFFICE_EXTS = new Set([
  '.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt',
  '.odt', '.ods', '.odp', '.fodt', '.fods', '.fodp',
  '.ott', '.ots', '.otp', '.rtf',
])
const DIAGRAM_EXTS = new Set(['.drawio'])
const CODE_EXTS = new Set([
  '.py', '.js', '.ts', '.tsx', '.jsx', '.rs', '.go', '.c', '.cpp', '.h',
  '.java', '.rb', '.sh', '.bash', '.zsh', '.lua', '.r', '.sql', '.toml',
  '.ini', '.cfg', '.conf', '.dockerfile', '.makefile',
  '.html', '.htm', '.css', '.scss', '.less', '.xml', '.xsl',
  '.tex', '.bib', '.cls', '.sty', '.bst',
])

function getExt(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot >= 0 ? path.slice(dot).toLowerCase() : ''
}

// ---------------------------------------------------------------------------
// Loading spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
      <RefreshCw size={16} className="animate-spin" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Image viewer
// ---------------------------------------------------------------------------

function ImageViewer({ path }: { path: string }) {
  const url = api.vaultPreviewUrl(path)
  return (
    <div className="flex items-center justify-center p-4">
      <img
        src={url}
        alt={path.split('/').pop() || 'image'}
        className="max-w-full max-h-[70vh] rounded-md object-contain"
        loading="lazy"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// PDF viewer (browser-native)
// ---------------------------------------------------------------------------

function PdfViewer({ path }: { path: string }) {
  const url = api.vaultPreviewUrl(path)
  return (
    <iframe
      src={url}
      className="w-full h-[calc(100vh-300px)] min-h-[500px] rounded-md border border-border"
      title={path.split('/').pop() || 'PDF'}
    />
  )
}

// ---------------------------------------------------------------------------
// Fallback — file info + download link
// ---------------------------------------------------------------------------

function FallbackViewer({ path }: { path: string }) {
  const name = path.split('/').pop() || 'file'
  const ext = getExt(path)
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-muted-foreground">
      <FileQuestion size={40} className="opacity-50" />
      <Text variant="bodyMd" weight="medium">{name}</Text>
      {ext && <Text variant="label" tone="muted" className="uppercase tracking-wide">{ext} file</Text>}
      <a
        href={api.downloadVaultUrl(path)}
        className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md border border-border type-label text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
        download
      >
        <Download size={13} /> Download
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Text content loader — fetches raw text via the preview endpoint
// ---------------------------------------------------------------------------

function TextContentLoader({
  path,
  refreshKey,
  children,
}: {
  path: string
  refreshKey?: number
  children: (content: string) => React.ReactNode
}) {
  const [content, setContent] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only show spinner on first load — subsequent refreshes update silently
    if (content === null) setInitialLoading(true)
    setError(null)
    fetch(api.vaultPreviewUrl(path))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then(text => {
        setContent(text)
        setInitialLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Failed to load file')
        setInitialLoading(false)
      })
  }, [path, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (initialLoading && content === null) return <Spinner />
  if (error) return <div className="text-red text-sm p-4">{error}</div>
  if (content === null) return null
  return <>{children(content)}</>
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface UniversalFileViewerProps {
  path: string
}

export function UniversalFileViewer({ path }: UniversalFileViewerProps) {
  const ext = getExt(path)
  const sseConnect = usePMStore(s => s.sseConnect)
  const sseRefreshCounter = usePMStore(s => s.sseRefreshCounter)
  const [refreshKey, setRefreshKey] = useState(0)

  // Ensure SSE connection exists (PM panel may not be open)
  useEffect(() => {
    // Extract project ID from vault-relative path: "projects/<project>/..."
    const parts = path.split('/')
    const projIdx = parts.indexOf('projects')
    const project = projIdx >= 0 && parts.length > projIdx + 1 ? parts[projIdx + 1] : ''
    if (project) sseConnect(project)
  }, [path, sseConnect])

  // Re-fetch content when SSE signals file changes on disk
  useEffect(() => {
    if (sseRefreshCounter > 0) setRefreshKey(k => k + 1)
  }, [sseRefreshCounter])

  // Images — direct from preview endpoint
  if (IMAGE_EXTS.has(ext)) {
    return <ImageViewer path={path} />
  }

  // PDF — browser-native iframe
  if (PDF_EXTS.has(ext)) {
    return <PdfViewer path={path} />
  }

  // JSON — tree view + code editor
  if (JSON_EXTS.has(ext)) {
    return (
      <TextContentLoader path={path} refreshKey={refreshKey}>
        {(content) => (
          <Suspense fallback={<Spinner />}>
            <LazyCodeViewer
              content={content} ext={ext} path={path}
              viewSlot={<Suspense fallback={<Spinner />}><LazyJsonViewer content={content} /></Suspense>}
            />
          </Suspense>
        )}
      </TextContentLoader>
    )
  }

  // CSV — table view + code editor
  if (CSV_EXTS.has(ext)) {
    return (
      <TextContentLoader path={path} refreshKey={refreshKey}>
        {(content) => (
          <Suspense fallback={<Spinner />}>
            <LazyCodeViewer
              content={content} ext={ext} path={path}
              viewSlot={<Suspense fallback={<Spinner />}><LazyCsvViewer content={content} /></Suspense>}
            />
          </Suspense>
        )}
      </TextContentLoader>
    )
  }

  // YAML — tree view + code editor
  if (YAML_EXTS.has(ext)) {
    return (
      <TextContentLoader path={path} refreshKey={refreshKey}>
        {(content) => (
          <Suspense fallback={<Spinner />}>
            <LazyCodeViewer
              content={content} ext={ext} path={path}
              viewSlot={<Suspense fallback={<Spinner />}><LazyYamlViewer content={content} /></Suspense>}
            />
          </Suspense>
        )}
      </TextContentLoader>
    )
  }

  // Office files — Collabora Online editor (with fallback)
  if (OFFICE_EXTS.has(ext)) {
    return (
      <Suspense fallback={<Spinner />}>
        <LazyCollaboraViewer path={path} />
      </Suspense>
    )
  }

  // Diagram files — draw.io embedded editor
  if (DIAGRAM_EXTS.has(ext)) {
    return (
      <Suspense fallback={<Spinner />}>
        <LazyDiagramEditor path={path} />
      </Suspense>
    )
  }

  // SVG files — SVG-Edit embedded editor
  if (SVG_EDIT_EXTS.has(ext)) {
    return (
      <Suspense fallback={<Spinner />}>
        <LazySVGEditor path={path} />
      </Suspense>
    )
  }

  // Code files — syntax-highlighted read-only CodeMirror
  if (CODE_EXTS.has(ext)) {
    return (
      <TextContentLoader path={path} refreshKey={refreshKey}>
        {(content) => (
          <Suspense fallback={<Spinner />}>
            <LazyCodeViewer content={content} ext={ext} path={path} />
          </Suspense>
        )}
      </TextContentLoader>
    )
  }

  // Unknown — fallback with download
  return <FallbackViewer path={path} />
}

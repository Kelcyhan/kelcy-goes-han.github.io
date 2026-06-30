/**
 * DiagramEditor — embeds the draw.io editor in an iframe for .drawio files.
 *
 * Uses raw iframe + postMessage (not react-drawio) to support zoom/scroll
 * persistence via the `scale` parameter on the `load` action.
 *
 * Flow:
 *   1. Fetch .drawio XML from vault via preview endpoint
 *   2. Render iframe pointing to embed.diagrams.net
 *   3. On iframe init → send load action with XML + saved scale
 *   4. On autosave → debounced write to vault + persist viewport state
 *   5. On export → save PNG/SVG alongside .drawio in vault
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw, Download, FileWarning, Save, Image, FileCode2, AlertCircle } from 'lucide-react'
import * as api from '@/lib/api.ts'
import { ActionButton, Toolbar, ToolbarGroup } from '@/components/primitives'

// ---------------------------------------------------------------------------
// Types for draw.io postMessage protocol
// ---------------------------------------------------------------------------

interface DrawioInitEvent {
  event: 'init'
}

interface DrawioAutosaveEvent {
  event: 'autosave'
  xml: string
  scale: number
  translate: { x: number; y: number }
}

interface DrawioSaveEvent {
  event: 'save'
  xml: string
  exit?: boolean
  scale?: number
  translate?: { x: number; y: number }
}

interface DrawioExportEvent {
  event: 'export'
  format: string
  data: string
  xml?: string
}

type DrawioEvent = DrawioInitEvent | DrawioAutosaveEvent | DrawioSaveEvent
  | DrawioExportEvent | { event: string }

// ---------------------------------------------------------------------------
// Blank diagram template
// ---------------------------------------------------------------------------

const BLANK_DRAWIO_XML = `<mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
  </root>
</mxGraphModel>`

// ---------------------------------------------------------------------------
// Embed URL
// ---------------------------------------------------------------------------

const DRAWIO_BASE_URL = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1'
  + '&libraries=1&noExitBtn=1&saveAndExit=0&noSaveBtn=1'

function getDrawioEmbedUrl() {
  const isDark = !window.matchMedia('(prefers-color-scheme: light)').matches
  return isDark
    ? DRAWIO_BASE_URL + '&ui=dark&dark=1'
    : DRAWIO_BASE_URL + '&ui=kennedy'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DiagramEditorProps {
  path: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type LoadState = 'loading' | 'ready' | 'error'

export default function DiagramEditor({ path }: DiagramEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [embedUrl, setEmbedUrl] = useState(() => getDrawioEmbedUrl())

  // Mutable refs for state that the message handler needs
  const xmlRef = useRef<string>('')
  const lastSavedXmlRef = useRef<string>('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingExportRef = useRef<{ format: string; savePath: string } | null>(null)
  const iframeReadyRef = useRef(false)

  // ── Sync theme with OS/browser preference ──
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      iframeReadyRef.current = false
      setEmbedUrl(getDrawioEmbedUrl())
      setLoadState('loading')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // ── Fetch XML from vault ──
  const [initialXml, setInitialXml] = useState<string | null>(null)

  useEffect(() => {
    setLoadState('loading')
    setLoadError('')
    fetch(api.vaultPreviewUrl(path))
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) return BLANK_DRAWIO_XML
          throw new Error(`HTTP ${res.status}`)
        }
        return res.text()
      })
      .then(xml => {
        const trimmed = xml.trim()
        setInitialXml(trimmed || BLANK_DRAWIO_XML)
      })
      .catch(err => {
        setLoadError(err.message || 'Failed to load diagram')
        setLoadState('error')
      })
  }, [path])

  // ── Helper: ensure a file exists (create if missing), then write content via PUT ──
  const ensureAndSave = useCallback(async (filePath: string, content: string) => {
    try {
      await api.saveVaultFile(filePath, content)
    } catch (err: any) {
      if (err?.message?.includes('404') || err?.message?.includes('not found')) {
        // File doesn't exist yet — create it first
        const lastSlash = filePath.lastIndexOf('/')
        const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash) : ''
        const name = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath
        await api.createVaultItem(dir, name, 'file', content)
        return
      }
      throw err
    }
  }, [])

  // ── Save to vault (debounced) ──
  const saveToVault = useCallback((xml: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (xml === lastSavedXmlRef.current) return
      setSaveStatus('saving')
      try {
        await ensureAndSave(path, xml)
        lastSavedXmlRef.current = xml
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
  }, [path, ensureAndSave])

  // ── Save export (PNG/SVG) alongside .drawio ──
  const saveExport = useCallback(async (format: string, dataUrl: string) => {
    const ext = format === 'svg' ? '.svg' : '.png'
    const exportPath = path.replace(/\.drawio$/i, ext)
    try {
      const base64 = dataUrl.split(',')[1]
      if (format === 'svg') {
        // SVG is text — decode and save directly
        const svgText = atob(base64)
        await ensureAndSave(exportPath, svgText)
      } else {
        // PNG is binary — decode, create blob, upload with exact filename
        const byteArr = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const blob = new Blob([byteArr], { type: 'image/png' })
        const fileName = exportPath.split('/').pop() || `diagram${ext}`
        const file = new File([blob], fileName, { type: blob.type })
        const lastSlash = exportPath.lastIndexOf('/')
        const destDir = lastSlash >= 0 ? exportPath.slice(0, lastSlash) : ''

        // Try to delete existing file first so upload uses clean name
        try { await api.deleteVaultItem(exportPath) } catch { /* doesn't exist yet — fine */ }
        await api.uploadFile(file, destDir)
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
    } catch (err) {
      console.error('Export save failed:', err)
      // Fallback: trigger browser download
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = (path.split('/').pop() || 'diagram').replace(/\.drawio$/i, ext)
      a.click()
    }
  }, [path, ensureAndSave])

  // ── PostMessage handler ──
  useEffect(() => {
    if (!initialXml) return

    function handleMessage(e: MessageEvent) {
      // Only accept messages from the iframe origin
      if (!iframeRef.current) return
      let data: DrawioEvent
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      } catch {
        return
      }
      if (!data || typeof data !== 'object' || !('event' in data)) return

      switch (data.event) {
        case 'init': {
          // Editor is ready — send load action (default zoom)
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ action: 'load', xml: initialXml, autosave: 1 }), '*'
          )
          xmlRef.current = initialXml!
          lastSavedXmlRef.current = initialXml!
          iframeReadyRef.current = true
          setLoadState('ready')
          break
        }

        case 'autosave': {
          const ev = data as DrawioAutosaveEvent
          xmlRef.current = ev.xml
          saveToVault(ev.xml)
          break
        }

        case 'save': {
          const ev = data as DrawioSaveEvent
          xmlRef.current = ev.xml
          saveToVault(ev.xml)
          break
        }

        case 'export': {
          const ev = data as DrawioExportEvent
          if (pendingExportRef.current) {
            saveExport(ev.format, ev.data)
            pendingExportRef.current = null
          }
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [initialXml, path, saveToVault, saveExport])

  // ── Unsaved changes warning ──
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (xmlRef.current && xmlRef.current !== lastSavedXmlRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // ── Export trigger ──
  const triggerExport = useCallback((format: 'png' | 'svg') => {
    if (!iframeRef.current?.contentWindow || !iframeReadyRef.current) return
    const ext = format === 'svg' ? '.svg' : '.png'
    pendingExportRef.current = {
      format,
      savePath: path.replace(/\.drawio$/i, ext),
    }
    iframeRef.current.contentWindow.postMessage(JSON.stringify({
      action: 'export',
      format: format === 'svg' ? 'xmlsvg' : 'png',
      scale: 2,
      transparent: false,
      border: 10,
    }), '*')
  }, [path])

  // ── Render ──

  if (loadState === 'error') {
    return (
      <div className="diagram-editor-error">
        <FileWarning size={40} className="opacity-50" />
        <span className="text-sm font-medium">{loadError || 'Failed to load diagram'}</span>
        <ActionButton
          onClick={() => { setLoadState('loading'); setInitialXml(null) }}
          variant="toolbar"
          size="toolbar"
        >
          <RefreshCw size={13} /> Retry
        </ActionButton>
        <ActionButton asChild variant="toolbar" size="toolbar">
        <a href={api.downloadVaultUrl(path)} download>
          <Download size={13} /> Download
        </a>
        </ActionButton>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Toolbar className="justify-between bg-[var(--bg-raised)] border-b-border px-3">
        <div className="diagram-editor-toolbar-left">
          <span className="diagram-editor-filename">
            {path.split('/').pop() || 'diagram.drawio'}
          </span>
        </div>
        <ToolbarGroup>
          {/* Save status */}
          <span className={`diagram-editor-save-status diagram-editor-save-${saveStatus}`}>
            {saveStatus === 'saving' && <><RefreshCw size={12} className="animate-spin" /> Saving...</>}
            {saveStatus === 'saved' && <><Save size={12} /> Saved</>}
            {saveStatus === 'error' && <><AlertCircle size={12} /> Save failed</>}
          </span>
          {/* Export buttons */}
          <ActionButton
            onClick={() => triggerExport('png')}
            variant="toolbar"
            size="toolbar"
            title="Export PNG to vault"
          >
            <Image size={13} /> Export PNG
          </ActionButton>
          <ActionButton
            onClick={() => triggerExport('svg')}
            variant="toolbar"
            size="toolbar"
            title="Export SVG to vault"
          >
            <FileCode2 size={13} /> Export SVG
          </ActionButton>
        </ToolbarGroup>
      </Toolbar>

      {/* Loading overlay */}
      {loadState === 'loading' && (
        <div className="diagram-editor-loading">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Loading diagram editor...</span>
        </div>
      )}

      {/* draw.io iframe — same inline style pattern as CollaboraViewer */}
      <iframe
        ref={iframeRef}
        src={initialXml !== null ? embedUrl : undefined}
        title="Diagram Editor"
        allow="clipboard-read; clipboard-write"
        style={{ flex: 1, width: '100%', height: '100%', border: 'none', display: 'block', opacity: loadState === 'ready' ? 1 : 0 }}
      />
    </div>
  )
}

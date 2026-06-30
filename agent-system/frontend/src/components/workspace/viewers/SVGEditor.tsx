/**
 * SVGEditor — embeds the self-hosted SVG-Edit editor for .svg files.
 *
 * SVG-Edit is served from /svgedit/ (copied from node_modules/svgedit/dist/editor).
 * Since it's same-origin, we access the editor API directly via
 * iframe.contentWindow.svgEditor / svgCanvas.
 *
 * Flow:
 *   1. Fetch .svg content from vault
 *   2. Render iframe pointing to /svgedit/index.html
 *   3. On editor ready → load SVG via svgCanvas.setSvgString()
 *   4. On save (Ctrl+S or toolbar) → debounced write back to vault
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw, Download, FileWarning, Save, AlertCircle } from 'lucide-react'
import * as api from '@/lib/api.ts'
import { ActionButton, Toolbar, ToolbarGroup } from '@/components/primitives'

// ---------------------------------------------------------------------------
// Blank SVG template
// ---------------------------------------------------------------------------

const BLANK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
</svg>`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SVGEditorProps {
  path: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type LoadState = 'loading' | 'ready' | 'error'

export default function SVGEditor({ path }: SVGEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const lastSavedSvgRef = useRef<string>('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorReadyRef = useRef(false)
  const [initialSvg, setInitialSvg] = useState<string | null>(null)

  // ── Detect light/dark for SVG-Edit theme ──
  const isLight = typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: light)').matches

  // SVG-Edit URL — use the self-hosted copy with theme param
  const svgeditUrl = `/svgedit/index.html`

  // ── Helper: ensure file exists then save ──
  const ensureAndSave = useCallback(async (filePath: string, content: string) => {
    try {
      await api.saveVaultFile(filePath, content)
    } catch (err: any) {
      if (err?.message?.includes('404') || err?.message?.includes('not found')) {
        const lastSlash = filePath.lastIndexOf('/')
        const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash) : ''
        const name = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath
        await api.createVaultItem(dir, name, 'file', content)
        return
      }
      throw err
    }
  }, [])

  // ── Save SVG to vault (debounced) ──
  const saveToVault = useCallback((svg: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (svg === lastSavedSvgRef.current) return
      setSaveStatus('saving')
      try {
        await ensureAndSave(path, svg)
        lastSavedSvgRef.current = svg
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
      } catch {
        setSaveStatus('error')
      }
    }, 1500)
  }, [path, ensureAndSave])

  // ── Fetch initial SVG content from vault ──
  useEffect(() => {
    setLoadState('loading')
    setLoadError('')
    fetch(api.vaultPreviewUrl(path))
      .then(res => {
        if (!res.ok) {
          if (res.status === 404) return BLANK_SVG
          throw new Error(`HTTP ${res.status}`)
        }
        return res.text()
      })
      .then(svg => {
        const trimmed = svg.trim()
        setInitialSvg(trimmed || BLANK_SVG)
      })
      .catch(err => {
        setLoadError(err.message || 'Failed to load SVG')
        setLoadState('error')
      })
  }, [path])

  // ── Poll for editor readiness, then load SVG ──
  useEffect(() => {
    if (!initialSvg) return

    let pollTimer: ReturnType<typeof setInterval> | null = null
    let saveInterval: ReturnType<typeof setInterval> | null = null

    function tryLoadSvg() {
      const win = iframeRef.current?.contentWindow as any
      if (!win) return false

      const svgCanvas = win.svgEditor?.svgCanvas || win.svgCanvas
      if (!svgCanvas || typeof svgCanvas.setSvgString !== 'function') return false

      // Editor is ready — load the SVG
      svgCanvas.setSvgString(initialSvg!)
      lastSavedSvgRef.current = initialSvg!
      editorReadyRef.current = true
      setLoadState('ready')

      // Start periodic auto-save: poll getSvgString every 3s
      saveInterval = setInterval(() => {
        try {
          const currentSvg = svgCanvas.getSvgString()
          if (currentSvg && currentSvg !== lastSavedSvgRef.current) {
            saveToVault(currentSvg)
          }
        } catch { /* editor might be reloading */ }
      }, 3000)

      return true
    }

    // Poll every 500ms until the editor is loaded
    pollTimer = setInterval(() => {
      if (tryLoadSvg() && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }, 500)

    return () => {
      if (pollTimer) clearInterval(pollTimer)
      if (saveInterval) clearInterval(saveInterval)
    }
  }, [initialSvg, saveToVault]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual save trigger ──
  const triggerSave = useCallback(() => {
    const win = iframeRef.current?.contentWindow as any
    const svgCanvas = win?.svgEditor?.svgCanvas || win?.svgCanvas
    if (!svgCanvas) return
    try {
      const svg = svgCanvas.getSvgString()
      if (svg) saveToVault(svg)
    } catch { /* ignore */ }
  }, [saveToVault])

  // ── Render ──

  if (loadState === 'error') {
    return (
      <div className="diagram-editor-error">
        <FileWarning size={40} className="opacity-50" />
        <span className="text-sm font-medium">{loadError || 'Failed to load SVG'}</span>
        <ActionButton
          onClick={() => { setLoadState('loading'); setInitialSvg(null) }}
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
            {path.split('/').pop() || 'drawing.svg'}
          </span>
        </div>
        <ToolbarGroup>
          {/* Save status */}
          <span className={`diagram-editor-save-status diagram-editor-save-${saveStatus}`}>
            {saveStatus === 'saving' && <><RefreshCw size={12} className="animate-spin" /> Saving...</>}
            {saveStatus === 'saved' && <><Save size={12} /> Saved</>}
            {saveStatus === 'error' && <><AlertCircle size={12} /> Save failed</>}
          </span>
          {/* Manual save */}
          <ActionButton onClick={triggerSave} variant="toolbar" size="toolbar" title="Save to vault">
            <Save size={13} /> Save
          </ActionButton>
        </ToolbarGroup>
      </Toolbar>

      {/* Loading overlay */}
      {loadState === 'loading' && (
        <div className="diagram-editor-loading">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Loading SVG editor...</span>
        </div>
      )}

      {/* SVG-Edit iframe */}
      <iframe
        ref={iframeRef}
        src={initialSvg !== null ? svgeditUrl : undefined}
        title="SVG Editor"
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          opacity: loadState === 'ready' ? 1 : 0,
          colorScheme: isLight ? 'light' : 'dark',
        }}
      />
    </div>
  )
}

/**
 * LatexView — Two-pane LaTeX workspace tab (editor | PDF preview).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Panel,
  Group as PanelGroup,
  type GroupImperativeHandle,
  type Layout,
  type PanelImperativeHandle,
} from 'react-resizable-panels'
import { Play, Loader2 } from 'lucide-react'
import { useTabStore } from '@/stores/tab-store.ts'
import type { LatexTabData, CiteEntry } from '@/stores/tab-store.ts'
import { LatexEditor } from './LatexEditor.tsx'
import { LatexPreview } from './LatexPreview.tsx'
import { LatexSplitter } from './LatexSplitter.tsx'
import { usePMStore } from '@/stores/pm-store.ts'
import * as api from '@/lib/api.ts'
import { ActionButton, Toolbar, ToolbarGroup } from '@/components/primitives'

const LATEX_EDITOR_PANEL_ID = 'latex-editor'
const LATEX_PDF_PANEL_ID = 'latex-pdf'
const DEFAULT_LATEX_SIZES: Layout = {
  [LATEX_EDITOR_PANEL_ID]: 55,
  [LATEX_PDF_PANEL_ID]: 45,
}

interface LatexViewProps {
  panelId: string
  tab: LatexTabData
}

/** Parse .bib content into citation entries using bibtex-parse. */
async function parseBibFile(content: string): Promise<CiteEntry[]> {
  try {
    const bibtexParse = await import('bibtex-parse')
    const entries = bibtexParse.default.entries(content)
    return entries.map((e: { key: string; TITLE?: string; AUTHOR?: string; YEAR?: string | number }) => ({
      key: e.key,
      title: e.TITLE,
      author: e.AUTHOR,
      year: e.YEAR != null ? String(e.YEAR) : undefined,
    }))
  } catch {
    return []
  }
}

export function LatexView({ panelId, tab }: LatexViewProps) {
  const setLatexContent = useTabStore(s => s.setLatexContent)
  const saveLatexFile = useTabStore(s => s.saveLatexFile)
  const compileLatex = useTabStore(s => s.compileLatex)
  const setLatexBib = useTabStore(s => s.setLatexBib)

  const [pdflatexAvailable, setPdflatexAvailable] = useState(true)
  const refreshLatex = useTabStore(s => s.refreshLatex)
  const sseConnect = usePMStore(s => s.sseConnect)
  const sseRefreshCounter = usePMStore(s => s.sseRefreshCounter)

  // Ensure SSE connection exists (PM panel may not be open)
  useEffect(() => {
    const parts = tab.filePath.split('/')
    const projIdx = parts.indexOf('projects')
    const project = projIdx >= 0 ? parts[projIdx + 1] : null
    if (project) sseConnect(project)
  }, [tab.filePath, sseConnect])

  // Refresh editor content when SSE signals file changes
  useEffect(() => {
    if (sseRefreshCounter === 0) return
    refreshLatex(panelId)
  }, [sseRefreshCounter, panelId, refreshLatex])

  // Check pdflatex availability on mount
  useEffect(() => {
    api.checkLatexStatus().then(s => setPdflatexAvailable(s.pdflatex_available)).catch(() => setPdflatexAvailable(false))
  }, [])

  // Load .bib files from same directory on mount
  useEffect(() => {
    const dir = tab.filePath.substring(0, tab.filePath.lastIndexOf('/'))
    if (!dir) return

    api.fetchVaultDirectory(dir).then(async (data) => {
      const bibFiles = data.entries.filter(e => e.type === 'file' && e.name.endsWith('.bib'))
      const allEntries: CiteEntry[] = []

      for (const bib of bibFiles) {
        const bibPath = dir ? `${dir}/${bib.name}` : bib.name
        try {
          const file = await api.fetchVaultFile(bibPath)
          const entries = await parseBibFile(file.body || '')
          allEntries.push(...entries)
        } catch { /* skip unreadable bib files */ }
      }

      if (allEntries.length > 0) {
        setLatexBib(panelId, allEntries)
      }
    }).catch(() => { /* no directory listing available */ })
  }, [tab.filePath, panelId, setLatexBib])

  const handleSave = useCallback(async () => {
    try {
      await saveLatexFile(panelId)
    } catch (err) {
      console.error('Save failed:', err)
    }
  }, [saveLatexFile, panelId])

  // Autosave: 2 seconds after the user stops typing
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!tab.isDirty || tab.saving) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      saveLatexFile(panelId).catch(() => {})
    }, 2000)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
  }, [tab.isDirty, tab.content, tab.saving, panelId, saveLatexFile])

  const handleCompile = useCallback(async () => {
    try {
      await compileLatex(panelId)
    } catch (err) {
      console.error('Compile failed:', err)
    }
  }, [compileLatex, panelId])

  const handleChange = useCallback((content: string) => {
    setLatexContent(panelId, content)
  }, [setLatexContent, panelId])

  // Splitter state — Overleaf-style dual-chevron collapse.
  const groupRef = useRef<GroupImperativeHandle>(null)
  const editorPanelRef = useRef<PanelImperativeHandle>(null)
  const pdfPanelRef = useRef<PanelImperativeHandle>(null)
  const lastSizesRef = useRef<Layout>(DEFAULT_LATEX_SIZES)
  const [editorCollapsed, setEditorCollapsed] = useState(false)
  const [pdfCollapsed, setPdfCollapsed] = useState(false)

  const onLayoutChanged = useCallback((layout: Layout) => {
    const editor = layout[LATEX_EDITOR_PANEL_ID]
    const pdf = layout[LATEX_PDF_PANEL_ID]
    if (editor != null && pdf != null && editor > 0 && pdf > 0) {
      lastSizesRef.current = layout
    }
  }, [])

  const collapseEditor = useCallback(() => {
    editorPanelRef.current?.collapse()
  }, [])

  const collapsePDF = useCallback(() => {
    pdfPanelRef.current?.collapse()
  }, [])

  const restoreSplit = useCallback(() => {
    groupRef.current?.setLayout(lastSizesRef.current)
  }, [])

  // Cmd/Ctrl + \  → restore if collapsed, else collapse editor (PDF reading mode).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === '\\') {
        e.preventDefault()
        if (editorCollapsed || pdfCollapsed) restoreSplit()
        else collapseEditor()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editorCollapsed, pdfCollapsed, restoreSplit, collapseEditor])

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Toolbar */}
      <Toolbar>
        <span className="flex-1 type-micro text-muted-foreground font-mono overflow-hidden text-ellipsis whitespace-nowrap">
          {tab.filePath}
        </span>
        <ToolbarGroup>
          {tab.saving && <span className="type-caption text-muted-foreground flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> saving</span>}
          {tab.isDirty && !tab.saving && <span className="inline-block w-[6px] h-[6px] rounded-full bg-orange" title="Unsaved — autosaves in 2s" />}

          <ActionButton
            variant="toolbarPrimary"
            size="toolbar"
            onClick={handleCompile}
            disabled={tab.compileState === 'compiling' || !pdflatexAvailable}
            title="Compile (Ctrl+Enter)"
          >
            {tab.compileState === 'compiling'
              ? <><Loader2 size={12} className="animate-spin" /> Compiling...</>
              : <><Play size={12} /> Compile</>
            }
          </ActionButton>
        </ToolbarGroup>
      </Toolbar>

      {tab.loading && <div className="text-muted-foreground text-sm py-10 text-center">Loading...</div>}
      {tab.error && <div className="text-red text-sm px-5 py-10 text-center">{tab.error}</div>}

      {/* Two-pane layout */}
      {!tab.loading && !tab.error && tab.content !== null && (
        <PanelGroup
          groupRef={groupRef}
          orientation="horizontal"
          className="flex-1 min-h-0"
          onLayoutChanged={onLayoutChanged}
        >
          <Panel
            id={LATEX_EDITOR_PANEL_ID}
            panelRef={editorPanelRef}
            defaultSize={55}
            minSize={20}
            collapsible
            collapsedSize={0}
            onResize={(s) => setEditorCollapsed(s.asPercentage === 0)}
            className="flex flex-col"
          >
            <LatexEditor
              value={tab.content}
              onChange={handleChange}
              onSave={handleSave}
              onCompile={handleCompile}
              bibEntries={tab.bibEntries}
            />
          </Panel>

          <LatexSplitter
            editorCollapsed={editorCollapsed}
            pdfCollapsed={pdfCollapsed}
            onCollapseEditor={collapseEditor}
            onCollapsePDF={collapsePDF}
            onRestore={restoreSplit}
          />

          <Panel
            id={LATEX_PDF_PANEL_ID}
            panelRef={pdfPanelRef}
            defaultSize={45}
            minSize={15}
            collapsible
            collapsedSize={0}
            onResize={(s) => setPdfCollapsed(s.asPercentage === 0)}
            className="flex flex-col"
          >
            <LatexPreview
              pdfUrl={tab.pdfUrl}
              compileState={tab.compileState}
              compileLog={tab.compileLog}
              compileErrors={tab.compileErrors}
              pdflatexAvailable={pdflatexAvailable}
            />
          </Panel>
        </PanelGroup>
      )}
    </div>
  )
}

/**
 * LatexSplitter — dual-chevron divider between the LaTeX editor and PDF panes.
 *
 * Wraps react-resizable-panels' Separator (PanelResizeHandle) and overlays a
 * 1px center line, top/bottom grip-dot patches, and a state-aware chevron stack:
 *   - split:           top button collapses editor, bottom button collapses PDF
 *   - editor collapsed: single restore button (>) brings editor back
 *   - PDF collapsed:    single restore button (<) brings PDF back
 */
import { Separator as PanelResizeHandle } from 'react-resizable-panels'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MouseEvent as RMouseEvent } from 'react'

interface Props {
  editorCollapsed: boolean
  pdfCollapsed: boolean
  onCollapseEditor: () => void
  onCollapsePDF: () => void
  onRestore: () => void
}

const stop = (e: RMouseEvent) => e.stopPropagation()

export function LatexSplitter({
  editorCollapsed,
  pdfCollapsed,
  onCollapseEditor,
  onCollapsePDF,
  onRestore,
}: Props) {
  const splitMode = !editorCollapsed && !pdfCollapsed

  return (
    <PanelResizeHandle className="latex-splitter">
      <span className="latex-splitter-line" aria-hidden />
      <span className="latex-splitter-grip latex-splitter-grip-top" aria-hidden />

      <div className={`latex-splitter-chevron-stack${splitMode ? '' : ' is-collapsed'}`}>
        {splitMode ? (
          <>
            <button
              type="button"
              className="latex-splitter-chevron-btn"
              onMouseDown={stop}
              onClick={(e) => { stop(e); onCollapseEditor() }}
              aria-label="Collapse editor (PDF fullscreen)"
              title="Collapse editor"
            >
              <ChevronLeft size={12} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="latex-splitter-chevron-btn latex-splitter-chevron-btn-bottom"
              onMouseDown={stop}
              onClick={(e) => { stop(e); onCollapsePDF() }}
              aria-label="Collapse PDF (editor fullscreen)"
              title="Collapse PDF"
            >
              <ChevronRight size={12} strokeWidth={2} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="latex-splitter-chevron-btn"
            onMouseDown={stop}
            onClick={(e) => { stop(e); onRestore() }}
            aria-label={editorCollapsed ? 'Restore split (show editor)' : 'Restore split (show PDF)'}
            title="Restore split (Ctrl/Cmd + \\)"
          >
            {editorCollapsed
              ? <ChevronRight size={12} strokeWidth={2} />
              : <ChevronLeft size={12} strokeWidth={2} />}
          </button>
        )}
      </div>

      <span className="latex-splitter-grip latex-splitter-grip-bottom" aria-hidden />
    </PanelResizeHandle>
  )
}

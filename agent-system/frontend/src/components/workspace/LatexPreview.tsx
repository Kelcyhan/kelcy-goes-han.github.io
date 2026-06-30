/**
 * LatexPreview — Browser-native PDF preview via iframe with blob URL.
 */
import { FileText, AlertTriangle, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import type { CompileError } from '@/stores/tab-store.ts'

interface LatexPreviewProps {
  pdfUrl: string | null
  compileState: 'idle' | 'compiling' | 'success' | 'error'
  compileLog: string | null
  compileErrors: CompileError[]
  pdflatexAvailable: boolean
}

export function LatexPreview({
  pdfUrl,
  compileState,
  compileLog,
  compileErrors,
  pdflatexAvailable,
}: LatexPreviewProps) {
  const [showLog, setShowLog] = useState(false)

  // Not available state
  if (!pdflatexAvailable && compileState === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
        <AlertTriangle size={32} className="text-orange" />
        <p className="text-sm text-center">
          LaTeX compilation unavailable
        </p>
        <p className="text-xs text-center opacity-70">
          Install TeX Live on the server to enable PDF preview
        </p>
      </div>
    )
  }

  // Idle state — no compilation yet
  if (compileState === 'idle' && !pdfUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
        <FileText size={32} />
        <p className="text-sm">Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] border border-[var(--color-border-subtle)] text-xs font-mono">Ctrl+Enter</kbd> to compile</p>
      </div>
    )
  }

  // Compiling state
  if (compileState === 'compiling') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 size={24} className="animate-spin text-accent" />
        <p className="text-sm">Compiling LaTeX...</p>
      </div>
    )
  }

  // Error state
  if (compileState === 'error') {
    return (
      <div className="flex-1 flex flex-col overflow-auto p-4 gap-3">
        <div className="flex items-center gap-2 text-red">
          <AlertTriangle size={16} />
          <span className="text-sm font-medium">Compilation Failed</span>
        </div>

        {compileErrors.length > 0 && (
          <div className="flex flex-col gap-2">
            {compileErrors.map((err, i) => (
              <div key={i} className="bg-[var(--bg-raised)] border border-red/30 rounded-md p-3">
                <div className="text-sm text-red font-medium">
                  {err.line != null ? `Line ${err.line}: ` : ''}{err.message}
                </div>
                <pre className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap font-mono leading-relaxed">
                  {err.full_context}
                </pre>
              </div>
            ))}
          </div>
        )}

        {compileLog && (
          <div>
            <button
              className="flex items-center gap-1 type-label text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0"
              onClick={() => setShowLog(!showLog)}
            >
              {showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showLog ? 'Hide' : 'Show'} full log
            </button>
            {showLog && (
              <pre className="mt-2 type-micro text-muted-foreground bg-[var(--bg-ingrained)] rounded-md p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono">
                {compileLog}
              </pre>
            )}
          </div>
        )}
      </div>
    )
  }

  // Success — show PDF
  return (
    <div className="h-full w-full flex flex-col min-h-0">
      {pdfUrl && (
        <>
          <div className="flex items-center justify-end px-2 py-1 shrink-0 border-b border-[var(--color-border-subtle)] bg-[var(--bg-surface)]">
            <button
              className="flex items-center gap-1 px-2 py-[2px] type-micro text-muted-foreground hover:text-accent border border-[var(--color-border-subtle)] rounded-sm bg-transparent cursor-pointer transition-colors"
              onClick={() => window.open(pdfUrl, '_blank')}
              title="Open PDF in browser tab (activates PDF extensions)"
            >
              <ExternalLink size={10} />
              Open in tab
            </button>
          </div>
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            className="flex-1 w-full border-none bg-white"
            title="PDF Preview"
          />
        </>
      )}
    </div>
  )
}

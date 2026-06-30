/**
 * LatexEditor — CodeMirror 6 with codemirror-lang-latex.
 *
 * Uses:
 *   @uiw/react-codemirror    MIT © uiw
 *   codemirror-lang-latex     MIT © TeXlyre (Overleaf grammar)
 */
import { useMemo, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { latex, latexCompletionSource } from 'codemirror-lang-latex'
import { autocompletion } from '@codemirror/autocomplete'
import { EditorView, keymap } from '@codemirror/view'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import type { CiteEntry } from '@/stores/tab-store.ts'

// Overleaf-inspired syntax highlighting for dark theme
const latexHighlightStyle = HighlightStyle.define([
  // Commands: \section, \begin, \textbf — bright blue (Overleaf's signature color)
  { tag: t.keyword, color: '#4499DD' },
  // \documentclass, \usepackage — teal/cyan
  { tag: t.definitionKeyword, color: '#26B5A0' },
  // Environment names: document, figure, equation — green
  { tag: t.className, color: '#8CC265' },
  // Section headings: \section{...} title text
  { tag: t.heading, color: '#4499DD', fontWeight: 'bold' },
  // Comments: % ... — muted gray-green
  { tag: t.comment, color: '#6A9955', fontStyle: 'italic' },
  // Math delimiters: $...$ — purple
  { tag: t.processingInstruction, color: '#C586C0' },
  // String arguments: {content inside braces} — orange/brown
  { tag: t.string, color: '#CE9178' },
  // \textbf content — bold
  { tag: t.strong, fontWeight: 'bold' },
  // \textit, \emph content — italic
  { tag: t.emphasis, fontStyle: 'italic' },
  // \cite — warm orange
  { tag: t.quote, color: '#D19A66' },
  // \label, \ref — teal
  { tag: t.labelName, color: '#26B5A0' },
  // Brackets {}[] — subtle light gray
  { tag: t.bracket, color: '#AAAAAA' },
  // Numbers — light purple
  { tag: t.number, color: '#B5CEA8' },
  // Verbatim content — monospace gray
  { tag: t.meta, color: '#9CDCFE' },
  // Operators
  { tag: t.operator, color: '#D4D4D4' },
])

interface LatexEditorProps {
  value: string
  onChange: (content: string) => void
  onSave?: () => void
  onCompile?: () => void
  bibEntries?: CiteEntry[]
}

// Dark theme matching the dashboard palette
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 'var(--type-body-md-size)',
    fontFamily: "var(--font-mono)",
    height: '100%',
  },
  '.cm-scroller': {
    lineHeight: '1.65',
    padding: '16px 20px',
    fontFamily: 'inherit',
    overflow: 'auto',
  },
  '.cm-content': {
    caretColor: 'var(--color-accent-bright, #7CC1EE)',
  },
  '.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-cursor-primary': {
    borderLeftColor: 'var(--color-accent-bright, #7CC1EE)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(91, 163, 217, 0.30) !important',
  },
  '::selection': {
    backgroundColor: 'rgba(91, 163, 217, 0.30) !important',
  },
  '.cm-line': { padding: '0' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg)',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-muted)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--bg-raised)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)',
  },
  '.cm-scroller::-webkit-scrollbar': { width: '6px' },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    background: 'var(--border)',
    borderRadius: '3px',
  },
  // Tooltip styling for hover docs
  '.cm-tooltip': {
    backgroundColor: 'var(--bg-panel, #1F1F34)',
    border: '1px solid var(--color-border, #333)',
    borderRadius: '6px',
    color: 'var(--text)',
    fontSize: 'var(--type-body-sm-size)',
    maxWidth: '400px',
    padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  '.cm-tooltip-autocomplete': {
    backgroundColor: 'var(--bg-panel, #1F1F34)',
    border: '1px solid var(--color-border, #333)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 8px',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'rgba(91, 163, 217, 0.25)',
    color: 'var(--color-text, #e0e0e0)',
  },
}, { dark: true })

function makeCitationSource(entries: CiteEntry[]) {
  const options = entries.map(e => ({
    label: e.key,
    type: 'text' as const,
    detail: e.year || undefined,
    info: [e.author, e.title].filter(Boolean).join(' — '),
    boost: 0,
  }))

  return function citeCompletionSource(context: CompletionContext): CompletionResult | null {
    const match = context.matchBefore(/\\(?:cite[tp]?|[Pp]arencite|[Tt]extcite|autocite)\{[^}]*$/)
    if (!match) return null

    const text = match.text
    const lastSep = Math.max(text.lastIndexOf('{'), text.lastIndexOf(','))
    if (lastSep < 0) return null

    const from = match.from + lastSep + 1
    return { from, options, validFor: /^[\w:._-]*$/ }
  }
}

export function LatexEditor({ value, onChange, onSave, onCompile, bibEntries = [] }: LatexEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const onSaveRef = useRef(onSave)
  const onCompileRef = useRef(onCompile)
  onSaveRef.current = onSave
  onCompileRef.current = onCompile

  const extensions = useMemo(() => {
    // Ctrl/Cmd+S save, Ctrl/Cmd+Enter compile — as CM6 keymaps
    // (DOM event listeners on parent don't work because CM6 captures keydown)
    const saveCompileKeymap = keymap.of([
      { key: 'Mod-s', run: () => { onSaveRef.current?.(); return true } },
      { key: 'Mod-Enter', run: () => { onCompileRef.current?.(); return true } },
    ])

    // Disable built-in autocomplete — it uses override:[] which replaces
    // the entire completion pipeline. We set up our own with both sources.
    const exts = [
      latex({ autoCloseBrackets: false, enableAutocomplete: false }),
      syntaxHighlighting(latexHighlightStyle),
      saveCompileKeymap,
      darkTheme,
      EditorView.lineWrapping,
    ]

    // Set up autocomplete with LaTeX commands + citation keys
    const sources = [latexCompletionSource(true)]
    if (bibEntries.length > 0) {
      sources.push(makeCitationSource(bibEntries))
    }
    exts.push(autocompletion({ override: sources, activateOnTyping: true }))

    return exts
  }, [bibEntries])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden [&_.cm-editor]:h-full [&_.cm-editor]:bg-[var(--bg-base)] [&_.cm-editor.cm-focused]:outline-none">
      <CodeMirror
        ref={editorRef}
        value={value}
        extensions={extensions}
        onChange={onChange}
        theme="none"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          searchKeymap: true,
          historyKeymap: true,
        }}
        style={{ height: '100%' }}
      />
    </div>
  )
}

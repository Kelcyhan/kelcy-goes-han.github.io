/**
 * MarkdownEditor — CodeMirror 6 with Obsidian-style live preview.
 *
 * Uses:
 *   @uiw/react-codemirror            MIT © uiw
 *   @yuya296/cm6-live-preview        MIT © yuya296
 *   @yuya296/cm6-live-preview-core   MIT © yuya296
 *   @codemirror/lang-markdown        MIT © Marijn Haverbeke and others
 *   @codemirror/language-data        MIT © Marijn Haverbeke and others
 */
import { useMemo, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { GFM, Strikethrough, Table } from '@lezer/markdown'
import { livePreviewPreset } from '@yuya296/cm6-live-preview'
import { EditorView, keymap } from '@codemirror/view'

interface MarkdownEditorProps {
  value: string
  onChange: (markdown: string) => void
  onSave?: () => void
}

// Dark theme matching the dashboard palette
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 'var(--type-body-md-size)',
    fontFamily: "var(--font-sans)",
    height: '100%',
  },
  '.cm-scroller': {
    lineHeight: '1.75',
    padding: '24px 32px',
    fontFamily: 'inherit',
  },
  '.cm-content': {
    caretColor: 'var(--color-accent-bright, #7CC1EE)',
    maxWidth: '780px',
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
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
  // Gutters (line numbers etc — hidden by default via basicSetup)
  '.cm-gutters': {
    backgroundColor: 'var(--bg)',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-muted)',
  },
  // Scrollbar
  '.cm-scroller::-webkit-scrollbar': { width: '6px' },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    background: 'var(--border)',
    borderRadius: '3px',
  },
}, { dark: true })

export function MarkdownEditor({ value, onChange, onSave }: MarkdownEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const extensions = useMemo(() => [
    markdown({
      extensions: [GFM, Strikethrough, Table],
      codeLanguages: languages,
    }),
    livePreviewPreset({
      livePreview: {
        blockRevealEnabled: true,
        imageRawShowsPreview: true,
      },
      semantics: { classPrefix: 'mb-' },
      typography: { classPrefix: 'mb-' },
    }),
    // Ctrl/Cmd+S as CM6 keymap — DOM listeners don't work because CM6 captures keydown
    keymap.of([
      { key: 'Mod-s', run: () => { onSaveRef.current?.(); return true } },
    ]),
    darkTheme,
    EditorView.lineWrapping,
  ], [])

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden [&_.cm-editor]:h-full [&_.cm-editor]:bg-[var(--bg-base)] [&_.cm-editor.cm-focused]:outline-none"
      style={{
        '--editor-primary-color': 'var(--accent)',
        '--editor-secondary-color': 'var(--text-muted)',
        '--editor-border': 'var(--border)',
        '--mb-link-color': 'var(--accent)',
        '--mb-font-mono': "var(--font-mono)",
        '--mb-inline-code-bg': 'var(--bg-tertiary)',
        '--mb-code-block-bg': 'var(--bg-tertiary)',
        '--mb-code-block-radius': '6px',
        '--mb-quote-border-color': 'var(--border)',
        '--mb-hr-color': 'var(--border)',
      } as React.CSSProperties}
    >
      <CodeMirror
        ref={editorRef}
        value={value}
        extensions={extensions}
        onChange={onChange}
        theme="none"
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: false,
          searchKeymap: true,
          historyKeymap: true,   // Cmd+Z / Cmd+Shift+Z undo/redo
        }}
        style={{ height: '100%' }}
      />
    </div>
  )
}

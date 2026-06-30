/**
 * InlineMarkdownEditor — Compact CodeMirror 6 editor for use inside cards.
 *
 * Unlike the full MarkdownEditor (used in DocView), this variant:
 * - Auto-heights to content (no fixed height)
 * - Minimal padding, transparent background
 * - Subtle border, focuses on edit
 * - Auto-saves on blur via onSave callback
 * - Shows placeholder when empty
 */
import { useMemo, useRef, useCallback, useEffect, useState } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { GFM, Strikethrough, Table } from '@lezer/markdown'
import { livePreviewPreset } from '@yuya296/cm6-live-preview'
import { EditorView } from '@codemirror/view'

interface InlineMarkdownEditorProps {
  value: string
  onSave: (value: string) => void
  placeholder?: string
  minHeight?: string
}

const inlineTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--text)',
    fontSize: 'var(--type-body-sm-size)',
    fontFamily: "var(--font-sans)",
  },
  '.cm-scroller': {
    lineHeight: '1.6',
    padding: '8px 10px',
    fontFamily: 'inherit',
    overflow: 'hidden',
  },
  '.cm-content': {
    caretColor: 'var(--color-accent-bright, #7CC1EE)',
    padding: '0',
    maxWidth: '100%',
    minHeight: '1.6em',
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
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-gutters': { display: 'none' },
}, { dark: true })

export function InlineMarkdownEditor({ value, onSave, placeholder, minHeight }: InlineMarkdownEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const [localValue, setLocalValue] = useState(value)
  const [focused, setFocused] = useState(false)
  const savedValueRef = useRef(value)

  // Sync external value changes (e.g. after API refresh)
  useEffect(() => {
    if (!focused) {
      setLocalValue(value)
      savedValueRef.current = value
    }
  }, [value, focused])

  const handleBlur = useCallback(() => {
    setFocused(false)
    const trimmed = localValue.trim()
    if (trimmed !== savedValueRef.current.trim()) {
      savedValueRef.current = trimmed
      onSave(trimmed)
    }
  }, [localValue, onSave])

  const extensions = useMemo(() => [
    markdown({
      extensions: [GFM, Strikethrough, Table],
      codeLanguages: languages,
    }),
    livePreviewPreset({
      livePreview: {
        blockRevealEnabled: false,
        imageRawShowsPreview: true,
      },
      semantics: { classPrefix: 'mb-' },
      typography: { classPrefix: 'mb-' },
    }),
    inlineTheme,
    EditorView.lineWrapping,
  ], [])

  // Show placeholder if empty and not focused
  if (!localValue && !focused) {
    return (
      <div
        className="text-muted-foreground type-body-sm italic cursor-text px-2.5 py-2 rounded border border-transparent hover:border-[var(--color-border-subtle)] transition-colors"
        onClick={() => setFocused(true)}
        style={{ minHeight: minHeight || '2em' }}
      >
        {placeholder || 'Click to add content...'}
      </div>
    )
  }

  return (
    <div
      className={`rounded border transition-colors ${focused ? 'border-[var(--color-accent)]' : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-subtle)]'}`}
      style={{
        minHeight: minHeight || '2em',
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
      onClick={(e) => e.stopPropagation()}
    >
      <CodeMirror
        ref={editorRef}
        value={localValue}
        extensions={extensions}
        onChange={setLocalValue}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        theme="none"
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          searchKeymap: true,
          historyKeymap: true,
        }}
        autoFocus={focused && !localValue}
      />
    </div>
  )
}

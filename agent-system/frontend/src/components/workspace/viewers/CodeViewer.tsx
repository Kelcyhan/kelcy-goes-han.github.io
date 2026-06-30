import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { languages } from '@codemirror/language-data'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState, type Extension } from '@codemirror/state'
import { Pencil, Eye, Save } from 'lucide-react'
import * as api from '@/lib/api.ts'

interface CodeViewerProps {
  content: string
  ext: string
  path?: string
  /** Optional custom view-mode renderer (e.g., CSV table, JSON tree). CodeMirror read-only is used if omitted. */
  viewSlot?: React.ReactNode
}

// Map file extensions to CodeMirror language names
const EXT_TO_LANG: Record<string, string> = {
  '.py': 'python',
  '.js': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.rs': 'rust',
  '.go': 'go',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.java': 'java',
  '.rb': 'ruby',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.lua': 'lua',
  '.r': 'r',
  '.sql': 'sql',
  '.toml': 'toml',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.xml': 'xml',
  '.xsl': 'xml',
  '.tex': 'stex',
  '.bib': 'stex',
  '.csv': 'csv',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.ini': 'ini',
}

const viewTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--text)',
    fontSize: 'var(--type-body-sm-size)',
    fontFamily: "var(--font-mono)",
  },
  '.cm-scroller': {
    lineHeight: '1.6',
    padding: '12px 16px',
    fontFamily: 'inherit',
  },
  '.cm-content': {
    caretColor: 'transparent',
    padding: '0',
  },
  '.cm-focused': { outline: 'none' },
  '.cm-cursor': { display: 'none' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: 'var(--type-label-size)',
    minWidth: '36px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 4px',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
}, { dark: true })

const editTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--text)',
    fontSize: 'var(--type-body-sm-size)',
    fontFamily: "var(--font-mono)",
  },
  '.cm-scroller': {
    lineHeight: '1.6',
    padding: '12px 16px',
    fontFamily: 'inherit',
  },
  '.cm-content': {
    caretColor: 'var(--color-accent-bright, #7CC1EE)',
    padding: '0',
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
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: 'var(--type-label-size)',
    minWidth: '36px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 4px',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
}, { dark: true })

export default function CodeViewer({ content, ext, path, viewSlot }: CodeViewerProps) {
  const [langExt, setLangExt] = useState<Extension | null>(null)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(content)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const editorRef = useRef<ReactCodeMirrorRef>(null)

  useEffect(() => {
    const langName = EXT_TO_LANG[ext]
    if (!langName) return
    const desc = languages.find(l =>
      l.name.toLowerCase() === langName ||
      l.alias.some(a => a.toLowerCase() === langName)
    )
    if (desc) {
      desc.load().then(support => setLangExt(support))
    }
  }, [ext])

  // Reset edit state when content changes (e.g., file reloaded) — but not while editing
  useEffect(() => {
    if (!editing) {
      setEditValue(content)
      setDirty(false)
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  const viewExtensions = useMemo(() => {
    const exts: Extension[] = [
      viewTheme,
      EditorView.lineWrapping,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ]
    if (langExt) exts.push(langExt)
    return exts
  }, [langExt])

  const [saveError, setSaveError] = useState<string | null>(null)

  // Ref for save so the CM6 keymap always sees current state
  const saveRef = useRef<() => void>(() => {})
  saveRef.current = async () => {
    if (!path || !dirty) return
    setSaving(true)
    setSaveError(null)
    try {
      await api.saveVaultFile(path, editValue)
      setDirty(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setSaveError(msg)
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = useCallback(() => { saveRef.current() }, [])

  const editExtensions = useMemo(() => {
    // Ctrl/Cmd+S as CM6 keymap — DOM listeners don't work because CM6 captures keydown
    const saveKeymap = keymap.of([
      { key: 'Mod-s', run: () => { saveRef.current(); return true } },
    ])
    const exts: Extension[] = [
      editTheme,
      EditorView.lineWrapping,
      saveKeymap,
    ]
    if (langExt) exts.push(langExt)
    return exts
  }, [langExt])

  const canEdit = !!path
  const toggleBtnBase = "inline-flex items-center gap-[3px] px-2 py-[3px] rounded border border-[var(--color-border-subtle)] bg-transparent type-micro cursor-pointer text-muted-foreground transition-all duration-150 hover:border-[var(--color-accent)] hover:text-accent-foreground"
  const toggleBtnActive = "border-[var(--color-accent)] text-accent-foreground bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"

  return (
    <div>
      {canEdit && (
        <div className="flex items-center gap-1 mb-2">
          <button
            className={`${toggleBtnBase} ${!editing ? toggleBtnActive : ''}`}
            onClick={() => setEditing(false)}
          >
            <Eye size={12} /> View
          </button>
          <button
            className={`${toggleBtnBase} ${editing ? toggleBtnActive : ''}`}
            onClick={() => { setEditing(true); setEditValue(dirty ? editValue : content) }}
          >
            <Pencil size={12} /> Edit
          </button>
          {editing && dirty && (
            <button
              className={`${toggleBtnBase} border-[var(--color-accent)] text-accent-foreground`}
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={12} /> {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          {editing && dirty && (
            <span className="inline-block w-[7px] h-[7px] rounded-full bg-orange ml-1" title="Unsaved changes" />
          )}
          {saveError && (
            <span className="type-micro text-red ml-2">{saveError}</span>
          )}
        </div>
      )}
      {editing ? (
        <div className="rounded-md border-2 border-[var(--color-accent)] bg-[var(--bg-base)] [&_.cm-editor]:!bg-transparent">
          <CodeMirror
            ref={editorRef}
            value={editValue}
            extensions={editExtensions}
            onChange={(val) => { setEditValue(val); setDirty(true) }}
            theme="none"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: false,
              drawSelection: true,
              searchKeymap: true,
              historyKeymap: true,
            }}
          />
        </div>
      ) : (
        <div className="[&_.cm-editor]:!bg-transparent">
          {viewSlot || (
            <CodeMirror
              value={content}
              extensions={viewExtensions}
              theme="none"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
              }}
              editable={false}
            />
          )}
        </div>
      )}
    </div>
  )
}

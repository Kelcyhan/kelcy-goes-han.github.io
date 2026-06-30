/**
 * CollaboraViewer — embeds Collabora Online editor in an iframe for Office files.
 *
 * Uses a two-step approach:
 * 1. Fetch editor URL + WOPI token from our backend
 * 2. Load a small host page that handles the form POST into a nested iframe
 *    (Collabora requires token via POST, not URL params)
 */
import { useEffect, useState } from 'react'
import { RefreshCw, Download, FileWarning } from 'lucide-react'
import * as api from '@/lib/api.ts'

interface CollaboraViewerProps {
  path: string
}

export default function CollaboraViewer({ path }: CollaboraViewerProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [hostPageHtml, setHostPageHtml] = useState('')

  useEffect(() => {
    setState('loading')
    setHostPageHtml('')

    api.fetchCollaboraStatus()
      .then(status => {
        if (!status.available) {
          setState('unavailable')
          return null
        }
        return api.fetchCollaboraEditorUrl(path)
      })
      .then(data => {
        if (!data) return
        // Build a self-contained host page that POSTs the token into Collabora
        const html = buildHostPage(data.editor_url, data.access_token, data.access_token_ttl)
        setHostPageHtml(html)
        setState('ready')
      })
      .catch(err => {
        setErrorMsg(err.message || 'Failed to load editor')
        setState('error')
      })
  }, [path])

  if (state === 'unavailable') {
    return <FallbackView path={path} reason="Collabora Online is not available" />
  }

  if (state === 'error') {
    return <FallbackView path={path} reason={errorMsg || 'Failed to load editor'} />
  }

  if (state === 'loading' || !hostPageHtml) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground" style={{ flex: 1 }}>
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm">Loading Office editor...</span>
      </div>
    )
  }

  // Use srcdoc to load a host page that handles the form POST
  return (
    <iframe
      srcDoc={hostPageHtml}
      title="Office Editor"
      style={{ flex: 1, width: '100%', height: '100%', border: 'none', display: 'block' }}
      allowFullScreen
      allow="clipboard-read; clipboard-write"
    />
  )
}

/**
 * Build a minimal HTML page that:
 * 1. Creates a full-screen iframe for Collabora
 * 2. POSTs the access token into it via a hidden form
 */
let _frameCounter = 0

function buildHostPage(editorUrl: string, token: string, ttl: number): string {
  const frameName = `cool_frame_${++_frameCounter}_${Date.now()}`
  // Make editor URL absolute if relative
  const absEditorUrl = editorUrl.startsWith('/') ? `${location.origin}${editorUrl}` : editorUrl
  return `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  iframe { width: 100%; height: 100%; border: none; }
</style></head><body>
<iframe name="${frameName}" allowfullscreen
  allow="clipboard-read; clipboard-write"></iframe>
<form id="f" target="${frameName}" action="${absEditorUrl}" method="post">
  <input name="access_token" value="${token}" type="hidden"/>
  <input name="access_token_ttl" value="${ttl}" type="hidden"/>
</form>
<script>document.getElementById('f').submit();</script>
</body></html>`
}

function FallbackView({ path, reason }: { path: string; reason: string }) {
  const name = path.split('/').pop() || 'file'
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-muted-foreground">
      <FileWarning size={40} className="opacity-50" />
      <span className="text-sm font-medium text-foreground">{name}</span>
      <span className="text-xs text-center max-w-xs">{reason}</span>
      <div className="flex gap-2 mt-2">
        <a
          href={api.downloadVaultUrl(path)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          download
        >
          <Download size={13} /> Download
        </a>
      </div>
    </div>
  )
}

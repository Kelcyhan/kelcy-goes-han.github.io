import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { transcribeStreamWsUrl } from '@/lib/api.ts'

export type StreamState = 'idle' | 'connecting' | 'streaming' | 'error'

const VOICE_MUTED_KEY = 'voice-muted'

export function getVoiceMuted(): boolean {
  return localStorage.getItem(VOICE_MUTED_KEY) === '1'
}
export function setVoiceMuted(muted: boolean) {
  localStorage.setItem(VOICE_MUTED_KEY, muted ? '1' : '0')
  _setStoreMuted(muted)
}

interface UseVoiceStreamOptions {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (msg: string) => void
  autoStart?: boolean
  /**
   * If true, this consumer pushes onto the claim stack on mount.
   * While any consumer holds a claim, only the topmost claimant
   * receives onInterim/onFinal callbacks. When the stack is empty,
   * all subscribers receive (legacy behaviour).
   */
  claim?: boolean
}

// ═══════════════════════════════════════════════════════════════
// Voice store — external state for useSyncExternalStore
// ═══════════════════════════════════════════════════════════════

interface VoiceStoreSnapshot {
  state: StreamState
  vadSpeaking: boolean
  muted: boolean
  finals: string[]
  interim: string
  error: string
  /** Topmost active voice claimant, or null if no one has claimed. */
  topClaim: string | null
}

let _snapshot: VoiceStoreSnapshot = {
  state: 'idle',
  vadSpeaking: false,
  muted: typeof window !== 'undefined' ? getVoiceMuted() : false,
  finals: [],
  interim: '',
  error: '',
  topClaim: null,
}

const _listeners = new Set<() => void>()

function _notify() {
  _snapshot = { ..._snapshot }
  _listeners.forEach(fn => fn())
}

function _getSnapshot(): VoiceStoreSnapshot {
  return _snapshot
}

function _subscribe(listener: () => void): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

// Store mutators
function _setStoreState(state: StreamState) {
  if (_snapshot.state === state) return
  _snapshot.state = state
  _notify()
}

function _setStoreVad(speaking: boolean) {
  if (_snapshot.vadSpeaking === speaking) return
  _snapshot.vadSpeaking = speaking
  _notify()
}

function _setStoreMuted(muted: boolean) {
  if (_snapshot.muted === muted) return
  _snapshot.muted = muted
  _notify()
}

function _pushFinal(text: string) {
  _snapshot = { ..._snapshot, finals: [..._snapshot.finals, text] }
  _listeners.forEach(fn => fn())
}

function _drainFinals(): string[] {
  const finals = _snapshot.finals
  if (finals.length > 0) {
    _snapshot = { ..._snapshot, finals: [] }
    _listeners.forEach(fn => fn())
  }
  return finals
}

function _setInterim(text: string) {
  if (_snapshot.interim === text) return
  _snapshot.interim = text
  _notify()
}

function _setError(msg: string) {
  _snapshot = { ..._snapshot, error: msg }
  _listeners.forEach(fn => fn())
}

function _clearError() {
  if (!_snapshot.error) return
  _snapshot = { ..._snapshot, error: '' }
  _listeners.forEach(fn => fn())
}

// ── Claim stack — routes voice to a modal/popover while one is open ──
//
// Default consumers (chat InputBar, PM HomeScreen) don't pass `claim`,
// so they keep their existing behaviour. A modal can pass `claim: true`
// to temporarily take ownership of voice finals/interim while it is
// mounted. When the stack is non-empty, only the topmost claimant fires;
// non-claimers become inactive. When empty, every subscriber receives
// (legacy behaviour).
const _claimants: string[] = []
let _claimIdCounter = 0

function _nextClaimId(): string {
  _claimIdCounter += 1
  return `claim_${_claimIdCounter}`
}

function _refreshTopClaim() {
  const next = _claimants.length > 0 ? _claimants[_claimants.length - 1] : null
  if (_snapshot.topClaim === next) return
  _snapshot = { ..._snapshot, topClaim: next }
  _listeners.forEach(fn => fn())
}

function _pushClaim(id: string) {
  _claimants.push(id)
  _refreshTopClaim()
}

function _popClaim(id: string) {
  const i = _claimants.lastIndexOf(id)
  if (i >= 0) _claimants.splice(i, 1)
  _refreshTopClaim()
}

// ═══════════════════════════════════════════════════════════════
// Global pipeline — survives across component mount/unmount cycles
// ═══════════════════════════════════════════════════════════════

// AudioContext + worklet
let _audioCtx: AudioContext | null = null
let _workletLoaded = false
let _workletVersion = 0
const WORKLET_VERSION = 3

// Persistent WebSocket
let _ws: WebSocket | null = null
let _wsReady: Promise<WebSocket> | null = null
let _wsKeepalive: ReturnType<typeof setInterval> | null = null

// Audio graph nodes (global — NOT torn down on component unmount)
let _micStream: MediaStream | null = null
let _source: MediaStreamAudioSourceNode | null = null
let _gainNode: GainNode | null = null
let _workletNode: AudioWorkletNode | null = null

// Pipeline state
let _pipelineStarting: Promise<void> | null = null
let _sttActive = false
let _finalText = '' // buffered interim text for commit
let _wsReconnecting = false
let _wsReconnectAttempts = 0
const WS_MAX_RECONNECT_ATTEMPTS = 5
const WS_RECONNECT_BASE_MS = 500

// Visibility handler — stored so we can remove it on teardown
let _visibilityHandler: (() => void) | null = null

// ── AudioContext helpers ──

async function getAudioContext(): Promise<AudioContext> {
  if (_audioCtx && _workletVersion < WORKLET_VERSION) {
    try { _audioCtx.close() } catch {}
    _audioCtx = null
    _workletLoaded = false
  }
  if (_audioCtx && _audioCtx.state !== 'closed') {
    if (_audioCtx.state === 'suspended') await _audioCtx.resume()
    return _audioCtx
  }
  _audioCtx = new AudioContext()
  _workletLoaded = false
  return _audioCtx
}

async function ensureWorklet(ctx: AudioContext): Promise<void> {
  if (_workletLoaded && _workletVersion >= WORKLET_VERSION) return
  await ctx.audioWorklet.addModule(`/audio-processor.js?v=${WORKLET_VERSION}`)
  _workletLoaded = true
  _workletVersion = WORKLET_VERSION
}

// ── WebSocket helpers ──

function connectPersistentWs(): Promise<WebSocket> {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    return Promise.resolve(_ws)
  }
  if (_wsReady && _ws && _ws.readyState === WebSocket.CONNECTING) {
    return _wsReady
  }

  _teardownWs()

  _wsReady = new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(transcribeStreamWsUrl())
    ws.binaryType = 'arraybuffer'
    _ws = ws

    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close()
        _ws = null
        _wsReady = null
        reject(new Error('Connection timeout'))
      }
    }, 5000)

    ws.onopen = () => {
      clearTimeout(timeout)
      _wsKeepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'KeepAlive' }))
        }
      }, 25000)
      resolve(ws)
    }

    ws.onmessage = (e: MessageEvent) => {
      _handleWsMessage(e)
    }

    ws.onclose = () => {
      clearTimeout(timeout)
      if (_wsKeepalive) { clearInterval(_wsKeepalive); _wsKeepalive = null }
      _ws = null
      _wsReady = null
      _handleWsClose()
    }

    ws.onerror = () => {
      clearTimeout(timeout)
      if (_wsKeepalive) { clearInterval(_wsKeepalive); _wsKeepalive = null }
      _ws = null
      _wsReady = null
      reject(new Error('WebSocket error'))
    }
  })

  return _wsReady
}

function _teardownWs() {
  if (_wsKeepalive) { clearInterval(_wsKeepalive); _wsKeepalive = null }
  if (_ws) {
    try { _ws.close() } catch {}
    _ws = null
  }
  _wsReady = null
}

// ── Pipeline lifecycle ──

function _endSttSession() {
  if (!_sttActive) return
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    try {
      _ws.send(JSON.stringify({ type: 'Finalize' }))
      _ws.send(JSON.stringify({ type: 'StopStream' }))
    } catch {}
  }
  _sttActive = false
}

// Continuous audio: send ALL audio to one long-running Deepgram session.
// Deepgram handles silence detection natively. VAD only drives the UI ring.

function _handleWorkletMessage(e: MessageEvent) {
  if (_snapshot.state !== 'streaming') return
  const data = e.data

  // VAD event — drives UI indicator only, does NOT gate audio or sessions
  if (data && data.type === 'vad') {
    _setStoreVad(data.speaking as boolean)
    return
  }

  // Audio data — send ALL audio to the persistent STT session
  const isAudio = data && typeof data.byteLength === 'number' && data.byteLength > 0
  if (isAudio) {
    if (_ws && _ws.readyState === WebSocket.OPEN && _sttActive) {
      _ws.send(data)
    }
  }
}

function _handleWsMessage(e: MessageEvent) {
  if (_snapshot.state !== 'streaming') return
  try {
    const msg = JSON.parse(e.data as string)
    if (msg.type === 'Error') {
      console.error('[voice] Server error:', msg.message)
      return
    }
    if (msg.type !== 'Results') return
    const alt = msg.channel?.alternatives?.[0]
    if (!alt) return
    const transcript = alt.transcript || ''
    if (msg.is_final) {
      const text = transcript || _finalText
      if (text) {
        console.log(`[voice] Final: "${text.slice(0, 60)}"`)
        _pushFinal(text)
      }
      _finalText = ''
      _setInterim('')
    } else if (transcript) {
      _finalText = transcript
      _setInterim(transcript)
    }
  } catch {}
}

function _handleWsClose() {
  if (_snapshot.state !== 'streaming') return
  _sttActive = false
  console.log('[voice] WS closed while streaming, attempting reconnect...')
  _reconnectWs()
}

async function _reconnectWs() {
  if (_wsReconnecting) return
  if (_snapshot.state !== 'streaming') return
  _wsReconnecting = true

  while (_wsReconnectAttempts < WS_MAX_RECONNECT_ATTEMPTS && _snapshot.state === 'streaming') {
    _wsReconnectAttempts++
    const delay = WS_RECONNECT_BASE_MS * Math.pow(2, _wsReconnectAttempts - 1)
    console.log(`[voice] WS reconnect attempt ${_wsReconnectAttempts}/${WS_MAX_RECONNECT_ATTEMPTS} in ${delay}ms`)
    await new Promise(r => setTimeout(r, delay))

    if (_snapshot.state !== 'streaming') break

    try {
      const ws = await connectPersistentWs()
      ws.send(JSON.stringify({ type: 'StartStream' }))
      _sttActive = true
      _wsReconnectAttempts = 0
      _wsReconnecting = false
      console.log('[voice] WS reconnected, STT session restarted')
      return
    } catch (err) {
      console.warn(`[voice] WS reconnect attempt ${_wsReconnectAttempts} failed:`, err)
    }
  }

  _wsReconnecting = false
  _wsReconnectAttempts = 0
  console.error('[voice] WS reconnection failed, stopping pipeline')
  _setError('Voice connection lost')
  stopPipeline({ skipCommit: true })
}

async function ensurePipeline(): Promise<void> {
  if (_snapshot.state === 'streaming') return
  if (_pipelineStarting) return _pipelineStarting

  _pipelineStarting = _initPipeline()
  try {
    await _pipelineStarting
  } finally {
    _pipelineStarting = null
  }
}

async function _initPipeline(): Promise<void> {
  console.log('[voice] Pipeline init starting...')
  _setStoreState('connecting')
  _finalText = ''
  _sttActive = false

  // Remove old visibility handler if any
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler)
    _visibilityHandler = null
  }

  // If audio graph already exists (re-attach after unmount), just resume
  if (_micStream && _workletNode && _source && _gainNode) {
    console.log('[voice] Pipeline re-attach (existing audio graph)')
    const ctx = await getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    _workletNode.port.onmessage = _handleWorkletMessage
    const track = _micStream.getAudioTracks()[0]
    if (track && track.readyState === 'live') {
      console.log('[voice] Mic track alive, resuming')
      _registerVisibilityHandler()
      _setStoreState('streaming')
      return
    }
    console.log('[voice] Mic track dead, recreating')
    _teardownAudio()
  }

  // Full init
  const micPromise = navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  const wsPromise = connectPersistentWs()
  const ctxPromise = getAudioContext().then(async (ctx) => {
    await ensureWorklet(ctx)
    return ctx
  })

  let micStream: MediaStream
  let ws: WebSocket
  let ctx: AudioContext
  try {
    ;[micStream, ws, ctx] = await Promise.all([micPromise, wsPromise, ctxPromise])
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Setup failed'
    _setError(msg.includes('denied') || msg.includes('Permission') || msg.includes('NotAllowed')
      ? 'Microphone access denied' : msg)
    _setStoreState('error')
    return
  }

  // Abort if stopPipeline ran while we were awaiting setup (it sets state to 'idle').
  // Without this, _initPipeline races stopPipeline and re-establishes streaming
  // after a mute, leaving the mic open while the icon shows muted.
  if (_snapshot.state !== 'connecting') {
    console.log('[voice] Pipeline init aborted — stopped during setup')
    micStream.getTracks().forEach(t => t.stop())
    return
  }

  console.log('[voice] Pipeline init — mic acquired, WS connected, worklet loaded')
  _micStream = micStream

  // Start one long-running STT session — Deepgram handles silence natively
  try {
    ws.send(JSON.stringify({ type: 'StartStream' }))
    _sttActive = true
    console.log('[voice] STT session started')
  } catch {
    _setError('Failed to start stream')
    _setStoreState('error')
    _teardownAudio()
    return
  }

  // Wire audio graph
  const source = ctx.createMediaStreamSource(micStream)
  const gain = ctx.createGain()
  gain.gain.value = 2.0
  const worklet = new AudioWorkletNode(ctx, 'pcm-processor')
  worklet.port.onmessage = _handleWorkletMessage

  source.connect(gain)
  gain.connect(worklet)
  worklet.connect(ctx.destination)

  _source = source
  _gainNode = gain
  _workletNode = worklet

  _setStoreState('streaming')
  console.log('[voice] Pipeline running — audio graph wired, state=streaming')

  _registerVisibilityHandler()
}

function _registerVisibilityHandler() {
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler)
  }
  _visibilityHandler = () => {
    if (document.hidden && _ws && _ws.readyState === WebSocket.OPEN && _snapshot.state === 'streaming') {
      _ws.send(JSON.stringify({ type: 'Finalize' }))
    }
  }
  document.addEventListener('visibilitychange', _visibilityHandler)
}

function _teardownAudio() {
  if (_workletNode) {
    _workletNode.port.onmessage = null
    _workletNode.disconnect()
    _workletNode = null
  }
  if (_source) {
    _source.disconnect()
    _source = null
  }
  if (_gainNode) {
    _gainNode.disconnect()
    _gainNode = null
  }
  if (_micStream) {
    _micStream.getTracks().forEach(t => t.stop())
    _micStream = null
  }
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler)
    _visibilityHandler = null
  }
}

/** Full stop — tears down audio graph. Called on mute. */
function stopPipeline(opts?: { skipCommit?: boolean }) {
  _endSttSession()
  _teardownAudio()
  _wsReconnecting = false
  _wsReconnectAttempts = 0

  if (opts?.skipCommit) {
    _finalText = ''
  } else if (_finalText) {
    _pushFinal(_finalText)
    _finalText = ''
  }

  _setStoreVad(false)
  _setStoreState('idle')
}

// ═══════════════════════════════════════════════════════════════
// React hook — subscribes to the voice store via useSyncExternalStore
// ═══════════════════════════════════════════════════════════════

export function useVoiceStream({ onInterim, onFinal, onError, autoStart, claim }: UseVoiceStreamOptions) {
  const snapshot = useSyncExternalStore(_subscribe, _getSnapshot)

  // Keep callback refs fresh
  const onInterimRef = useRef(onInterim)
  const onFinalRef = useRef(onFinal)
  const onErrorRef = useRef(onError)
  onInterimRef.current = onInterim
  onFinalRef.current = onFinal
  onErrorRef.current = onError

  // Stable id for this consumer instance — used by the claim stack
  const claimIdRef = useRef<string | null>(null)
  if (claimIdRef.current === null) claimIdRef.current = _nextClaimId()

  // Push/pop on the claim stack while `claim` is true
  useEffect(() => {
    if (!claim) return
    const id = claimIdRef.current!
    _pushClaim(id)
    return () => _popClaim(id)
  }, [claim])

  // A consumer is active when nobody has claimed, OR when it is the topmost
  // claimant. Non-claimers go inactive while a modal holds the claim.
  const isActive = snapshot.topClaim === null
    ? true
    : snapshot.topClaim === claimIdRef.current

  // Drain final transcripts from the store queue (proper store contract via _drainFinals)
  useEffect(() => {
    if (!isActive) return
    if (snapshot.finals.length > 0) {
      const finals = _drainFinals()
      for (const text of finals) {
        onFinalRef.current(text)
      }
    }
  }, [snapshot.finals, isActive])

  // Forward interim text changes.
  // When this consumer goes inactive (a modal claimed), fire one empty
  // interim so the inactive UI clears any stale "Listening…" preview.
  useEffect(() => {
    if (!isActive) {
      onInterimRef.current('')
      return
    }
    onInterimRef.current(snapshot.interim)
  }, [snapshot.interim, isActive])

  // Forward errors (always — errors are global, not claim-gated)
  useEffect(() => {
    if (snapshot.error) {
      onErrorRef.current(snapshot.error)
      _clearError()
    }
  }, [snapshot.error])

  const start = useCallback(async () => {
    await ensurePipeline()
  }, [])

  const stop = useCallback((opts?: { skipCommit?: boolean }) => {
    stopPipeline(opts)
  }, [])

  const toggleMute = useCallback(() => {
    const next = !_snapshot.muted
    setVoiceMuted(next)
    if (next) {
      stopPipeline()
    } else {
      // Unmuting — start pipeline from this user gesture (needed for mobile AudioContext)
      ensurePipeline()
    }
  }, [])

  // Auto-start effect
  useEffect(() => {
    if (autoStart && !snapshot.muted && snapshot.state === 'idle') {
      const t = setTimeout(() => { ensurePipeline() }, 300)
      return () => clearTimeout(t)
    }
  }, [autoStart, snapshot.state, snapshot.muted])

  return {
    state: snapshot.state,
    vadSpeaking: snapshot.vadSpeaking,
    muted: snapshot.muted,
    start,
    stop,
    toggleMute,
  }
}

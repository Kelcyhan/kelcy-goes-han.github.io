import { create } from 'zustand'
import * as api from '@/lib/api.ts'
import { VoiceAudioManager } from '@/lib/voice-audio.ts'

export type VoicePhase = 'idle' | 'starting' | 'active' | 'stopping'

interface VoiceStore {
  phase: VoicePhase
  muted: boolean
  available: boolean
  /** Accumulated final transcript segments (committed by STT). */
  finalText: string
  /** Current interim transcript (partial, not yet final). */
  interimText: string

  fetchStatus: () => Promise<void>
  start: () => Promise<void>
  stop: () => void
  toggleMute: () => void
  /** Send accumulated text to the voice mediator. */
  send: () => void
  /** Clear transcript without sending. */
  clearTranscript: () => void
}

let _ws: WebSocket | null = null
let _audio: VoiceAudioManager | null = null

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  phase: 'idle',
  muted: false,
  available: false,
  finalText: '',
  interimText: '',

  fetchStatus: async () => {
    try {
      const data = await api.fetchVoiceStatus()
      set({ available: data.available ?? Boolean(data.running !== undefined) })
    } catch {}
  },

  start: async () => {
    if (get().phase !== 'idle') return
    set({ phase: 'starting', finalText: '', interimText: '' })

    try {
      const audio = new VoiceAudioManager()
      await audio.init()
      _audio = audio

      const ws = new WebSocket(api.voiceAudioWsUrl())
      ws.binaryType = 'arraybuffer'
      _ws = ws

      ws.onopen = async () => {
        try {
          await audio.startCapture((pcm: ArrayBuffer) => {
            // Only send audio when unmuted and mic is "on"
            if (ws.readyState === WebSocket.OPEN && !get().muted) {
              ws.send(pcm)
            }
          })
          // Start muted — user taps mic to begin speaking
          set({ muted: true })
          ws.send(JSON.stringify({ type: 'mute' }))
        } catch (e) {
          console.error('Mic capture failed:', e)
          ws.close()
          set({ phase: 'idle' })
        }
      }

      ws.onmessage = (e: MessageEvent) => {
        if (e.data instanceof ArrayBuffer) {
          audio.playChunk(e.data)
        } else {
          try {
            const msg = JSON.parse(e.data as string)
            switch (msg.type) {
              case 'ready':
                set({ phase: 'active' })
                break
              case 'transcript': {
                const text = msg.text || ''
                if (msg.is_final && text) {
                  // Commit this segment to finalText
                  set(s => ({
                    finalText: s.finalText ? s.finalText + ' ' + text : text,
                    interimText: '',
                  }))
                } else {
                  // Interim — show as preview
                  set({ interimText: text })
                }
                break
              }
              case 'utterance_end':
                // Silence detected — clear interim
                set({ interimText: '' })
                break
              case 'speaking':
                audio.startPlayback()
                break
              case 'tts_interrupt':
                audio.interruptPlayback()
                break
              case 'tts_done':
                audio.endPlayback()
                break
              case 'error':
                console.error('Voice error:', msg.message)
                ws.close()
                break
            }
          } catch {}
        }
      }

      ws.onclose = () => {
        if (_audio) { _audio.stop(); _audio = null }
        _ws = null
        set({ phase: 'idle', muted: false, finalText: '', interimText: '' })
      }

      ws.onerror = () => {
        console.error('Voice WebSocket error')
      }
    } catch (e) {
      console.error('Voice start failed:', e)
      if (_audio) { _audio.stop(); _audio = null }
      _ws = null
      set({ phase: 'idle' })
    }
  },

  stop: () => {
    const phase = get().phase
    if (phase !== 'active' && phase !== 'starting') return
    set({ phase: 'stopping' })
    if (_audio) { _audio.stop(); _audio = null }
    if (_ws) { _ws.close(); _ws = null }
  },

  toggleMute: () => {
    const { muted } = get()
    const newMuted = !muted
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: newMuted ? 'mute' : 'unmute' }))
    }
    // When unmuting (starting to listen), clear interim
    if (!newMuted) {
      set({ muted: false, interimText: '' })
    } else {
      set({ muted: true, interimText: '' })
    }
  },

  send: () => {
    const { finalText, interimText } = get()
    const text = (finalText + (interimText ? ' ' + interimText : '')).trim()
    if (!text) return
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: 'send', text }))
    }
    // Clear transcript and mute (stop listening after send)
    set({ finalText: '', interimText: '', muted: true })
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: 'mute' }))
    }
  },

  clearTranscript: () => {
    set({ finalText: '', interimText: '' })
  },
}))

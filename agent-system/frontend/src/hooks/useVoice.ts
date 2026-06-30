import { useState, useRef, useEffect, useCallback } from 'react'
import * as api from '@/lib/api.ts'

interface UseVoiceOptions {
  onTranscript: (text: string) => void
}

function getBestMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export function useVoice({ onTranscript }: UseVoiceOptions) {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect voice support on mount
  useEffect(() => {
    api.checkVoiceSupport().then(setVoiceEnabled)
  }, [])

  const showError = useCallback((msg: string) => {
    setError(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setError(null), 4000)
  }, [])

  const toggleRecording = useCallback(async () => {
    if (!voiceEnabled) return
    setError(null)

    // Stop recording
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      return
    }

    // Start recording
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      showError('Microphone access denied')
      return
    }
    streamRef.current = stream

    audioChunksRef.current = []
    const mimeType = getBestMimeType()
    const options = mimeType ? { mimeType } : {}

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, options)
    } catch {
      stream.getTracks().forEach(t => t.stop())
      streamRef.current = null
      showError('Recording not supported')
      return
    }

    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      streamRef.current = null
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType })
      audioChunksRef.current = []
      setRecording(false)

      if (blob.size === 0) {
        showError('No audio captured')
        mediaRecorderRef.current = null
        return
      }

      setTranscribing(true)

      try {
        const ext = recorder.mimeType.includes('mp4') ? 'm4a' : 'webm'
        const data = await api.transcribeAudio(blob, `recording.${ext}`)
        if (data.text) {
          onTranscript(data.text)
        } else {
          showError('No speech detected')
        }
      } catch (err) {
        console.error('Transcription failed:', err)
        showError('Transcription failed')
      }

      setTranscribing(false)
      mediaRecorderRef.current = null
    }

    // Use timeslice to ensure ondataavailable fires regularly
    // (some browsers don't fire it without timeslice until stop)
    recorder.start(1000)
    setRecording(true)
  }, [voiceEnabled, onTranscript, showError])

  return { voiceEnabled, recording, transcribing, error, toggleRecording }
}

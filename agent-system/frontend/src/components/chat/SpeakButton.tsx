import { useState, useRef, useCallback } from 'react'
import { speakText } from '@/lib/api.ts'
import type { ContentBlock } from '@/lib/types.ts'
import { IconButton } from '@/components/primitives'

interface SpeakButtonProps {
  content: ContentBlock[]
}

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('\n\n')
}

export function SpeakButton({ content }: SpeakButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  const handleClick = useCallback(async () => {
    // If playing, stop
    if (state === 'playing') {
      sourceRef.current?.stop()
      sourceRef.current = null
      ctxRef.current?.close()
      ctxRef.current = null
      setState('idle')
      return
    }

    if (state === 'loading') return

    const text = extractText(content)
    if (!text.trim()) return

    // Create and unlock AudioContext synchronously within the user gesture.
    // Do NOT close it — we need it alive to play audio after the async fetch.
    // This keeps the audio permission alive on iOS Safari regardless of latency.
    const ctx = new AudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    ctxRef.current = ctx

    setState('loading')
    try {
      const blob = await speakText(text)
      const arrayBuffer = await blob.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      sourceRef.current = source

      source.onended = () => {
        setState('idle')
        ctx.close()
        ctxRef.current = null
        sourceRef.current = null
      }

      source.start()
      setState('playing')
    } catch (err) {
      console.error('Speak failed:', err)
      ctx.close()
      ctxRef.current = null
      sourceRef.current = null
      setState('idle')
    }
  }, [content, state])

  return (
    <IconButton
      variant="appShell"
      size="sm"
      className={`border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] ${state === 'playing' ? 'border-[var(--color-red)] text-[var(--color-red)]' : ''}`}
      onClick={handleClick}
      title={state === 'playing' ? 'Stop' : 'Read aloud'}
    >
      {state === 'loading' ? (
        <span className="w-3.5 h-3.5 border-2 border-transparent border-t-[var(--color-accent)] rounded-full animate-spin-fast" />
      ) : state === 'playing' ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="2" y="2" width="10" height="10" rx="1" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </IconButton>
  )
}

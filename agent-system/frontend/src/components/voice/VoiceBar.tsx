import { useVoiceStore } from '@/stores/voice-store.ts'
import { ActionButton, IconButton } from '@/components/primitives'

export function VoiceBar() {
  const phase = useVoiceStore(s => s.phase)
  const muted = useVoiceStore(s => s.muted)
  const finalText = useVoiceStore(s => s.finalText)
  const interimText = useVoiceStore(s => s.interimText)
  const toggleMute = useVoiceStore(s => s.toggleMute)
  const send = useVoiceStore(s => s.send)
  const stop = useVoiceStore(s => s.stop)

  if (phase !== 'active' && phase !== 'starting') return null

  const displayText = finalText + (interimText ? (finalText ? ' ' : '') + interimText : '')
  const hasText = displayText.trim().length > 0
  const isListening = !muted && phase === 'active'

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)] border-b border-[var(--color-border-subtle)] shrink-0">
      {phase === 'starting' ? (
        <span className="text-muted-foreground type-body-sm py-1">Starting voice layer…</span>
      ) : (
        <>
          <IconButton
            variant="input"
            size="input"
            className={`shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] ${isListening ? 'bg-[rgba(224,90,75,0.2)] !border-[var(--color-red)] !text-[var(--color-red)] animate-voice-pulse' : ''}`}
            onClick={toggleMute}
            title={isListening ? 'Stop listening' : 'Start listening'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <rect x="9" y="1" width="6" height="11" rx="3" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </IconButton>

          <div className={`flex-1 min-w-0 type-body-sm px-2.5 py-1.5 bg-[var(--bg-card)] border border-[var(--color-border)] rounded-md whitespace-nowrap overflow-hidden text-ellipsis min-h-8 leading-5 ${!hasText ? 'text-muted-foreground' : 'text-foreground'}`}>
            {hasText ? (
              <>
                <span>{finalText}</span>
                {interimText && <span className="text-muted-foreground italic">{finalText ? ' ' : ''}{interimText}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">
                {isListening ? 'Listening…' : 'Tap mic to speak'}
              </span>
            )}
          </div>

          <ActionButton
            variant="panel"
            size="sm"
            className="shrink-0 whitespace-nowrap shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
            onClick={send}
            disabled={!hasText}
            title="Send to voice agent"
          >
            Send
          </ActionButton>

          <ActionButton
            variant="panel"
            size="sm"
            className="shrink-0 whitespace-nowrap border-[rgba(224,90,75,0.4)] text-[var(--color-red)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] hover:bg-[rgba(224,90,75,0.15)] hover:text-[var(--color-red)]"
            onClick={stop}
            title="Stop voice layer"
          >
            Stop
          </ActionButton>
        </>
      )}
    </div>
  )
}

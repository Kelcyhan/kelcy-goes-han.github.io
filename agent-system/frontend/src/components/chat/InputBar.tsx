import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useSessionStore } from '@/stores/session-store.ts'
import { useChatStore } from '@/stores/chat-store.ts'
import * as api from '@/lib/api.ts'
import { cn } from '@/lib/utils.ts'
import { useVoice } from '@/hooks/useVoice.ts'
import { useVoiceStream } from '@/hooks/useVoiceStream.ts'
import { FileSearchPicker, addToRecent } from './FileSearchPicker.tsx'
import { MentionAutocomplete, findMentionTrigger, type MentionSelection } from './MentionAutocomplete.tsx'
import { ActionButton, AppIcon, IconButton } from '@/components/primitives'

interface Attachment {
  id: string
  file: File
  preview: string | null
  uploading: boolean
  vaultPath: string | null
  error: boolean
}

export interface InputBarHandle {
  addVaultFile: (vaultPath: string, fileName?: string) => void
  restoreText: (text: string) => void
}

interface InputBarProps {
  sessionName: string
}

export const InputBar = forwardRef<InputBarHandle, InputBarProps>(function InputBar({ sessionName }, ref) {
  const [text, setText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [streamFailed, setStreamFailed] = useState(false)
  const sendState = useChatStore(s => s.sessions[sessionName]?.sendState ?? 'idle')
  const setSendState = useCallback((state: 'idle' | 'sending' | 'queued') => {
    useChatStore.getState().setSendState(sessionName, state)
  }, [sessionName])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const [cursorPos, setCursorPos] = useState(0)
  const [mentionOpen, setMentionOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const usedVoiceInput = useRef(false)
  const sessionStatus = useSessionStore(s => s.sessionStatuses[sessionName] ?? 'unknown')
  const setSessionStatus = useSessionStore(s => s.setSessionStatus)
  const draftInput = useSessionStore(s => s.draftInput)
  const setDraftInput = useSessionStore(s => s.setDraftInput)
  const isWorking = sessionStatus === 'working'

  const { voiceEnabled, transcribing, error: voiceError, toggleRecording } = useVoice({
    onTranscript: (transcript) => {
      usedVoiceInput.current = true
      setText(prev => prev ? prev + ' ' + transcript : transcript)
      textareaRef.current?.focus()
    },
  })

  // Track cursor position for voice insertion
  const cursorPosRef = useRef(0)
  useEffect(() => { cursorPosRef.current = cursorPos }, [cursorPos])

  // Suppress late finals that arrive after the user already pressed send
  const justSentRef = useRef(false)

  const { state: streamState, vadSpeaking, muted, start: startStream, stop: _stopStream, toggleMute } = useVoiceStream({
    onInterim: (t) => {
      if (justSentRef.current) return // ignore interims from previous utterance
      setInterimText(t)
    },
    onFinal: (t) => {
      if (justSentRef.current) {
        // Late final from before send — discard it
        justSentRef.current = false
        return
      }
      usedVoiceInput.current = true
      // Insert at cursor position, not appended
      setText(prev => {
        const pos = cursorPosRef.current
        const before = prev.slice(0, pos)
        const after = prev.slice(pos)
        const spaceBefore = before && !before.endsWith(' ') ? ' ' : ''
        const spaceAfter = after && !after.startsWith(' ') ? ' ' : ''
        const newText = before + spaceBefore + t + spaceAfter + after
        const newPos = before.length + spaceBefore.length + t.length
        cursorPosRef.current = newPos
        setCursorPos(newPos)
        if (sessionName) setDraftInput(sessionName, newText)
        requestAnimationFrame(() => {
          textareaRef.current?.setSelectionRange(newPos, newPos)
        })
        return newText
      })
      setInterimText('')
      textareaRef.current?.focus()
    },
    onError: (msg) => {
      console.warn('Voice stream error:', msg)
      setStreamFailed(true)
      setInterimText('')
    },
    autoStart: voiceEnabled && !streamFailed,
  })

  const isStreaming = streamState === 'streaming' || streamState === 'connecting'
  const useStreamMode = voiceEnabled && !streamFailed

  useEffect(() => {
    if (sessionName) {
      setText(draftInput[sessionName] ?? '')
      setAttachments([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionName])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [text, interimText])

  // Restore queued message from localStorage on mount
  useEffect(() => {
    if (!sessionName) return
    try {
      const saved = localStorage.getItem(`queue_${sessionName}`)
      if (saved && !useChatStore.getState().sessions[sessionName]?.queuedMessage) {
        useChatStore.getState().setQueuedMessage(sessionName, saved)
        setSendState('queued')
      }
    } catch {}
  }, [sessionName])

  useEffect(() => {
    return () => {
      attachments.forEach(a => { if (a.preview) URL.revokeObjectURL(a.preview) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFile = useCallback(async (file: File) => {
    const id = Math.random().toString(36).slice(2, 10)
    const isImage = file.type.startsWith('image/')
    const preview = isImage ? URL.createObjectURL(file) : null
    const attachment: Attachment = { id, file, preview, uploading: true, vaultPath: null, error: false }
    setAttachments(prev => [...prev, attachment])
    try {
      const result = await api.uploadFile(file)
      setAttachments(prev => prev.map(a =>
        a.id === id ? { ...a, uploading: false, vaultPath: result.path } : a
      ))
    } catch (err) {
      console.error('Upload failed:', err)
      setAttachments(prev => prev.map(a =>
        a.id === id ? { ...a, uploading: false, error: true } : a
      ))
    }
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const removed = prev.find(a => a.id === id)
      if (removed?.preview) URL.revokeObjectURL(removed.preview)
      return prev.filter(a => a.id !== id)
    })
  }, [])

  const addVaultFile = useCallback((vaultPath: string, fileName?: string) => {
    const name = fileName || vaultPath.split('/').pop() || vaultPath
    const id = Math.random().toString(36).slice(2, 10)
    const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name)
    setAttachments(prev => [...prev, {
      id,
      file: new File([], name),
      preview: isImage ? api.downloadVaultUrl(vaultPath) : null,
      uploading: false,
      vaultPath,
      error: false,
    }])
    addToRecent(vaultPath, name)
  }, [])

  const restoreText = useCallback((t: string) => {
    setText(t)
    if (sessionName) setDraftInput(sessionName, t)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [sessionName, setDraftInput])

  useImperativeHandle(ref, () => ({ addVaultFile, restoreText }), [addVaultFile, restoreText])

  const handleSend = useCallback(async () => {
    if (!sessionName) return
    // Don't stop the stream on send — mic stays listening

    // Combine finalized text with any pending interim text the user can see
    const fullText = interimText
      ? (text ? text + ' ' + interimText : interimText)
      : text

    const parts: string[] = []
    if (usedVoiceInput.current && fullText.trim()) {
      parts.push('[The following was input via speech-to-text — some words may be inaccurate.]')
    }
    if (fullText.trim()) parts.push(fullText.trim())
    for (const a of attachments) {
      if (a.vaultPath) parts.push(`\`${a.vaultPath}\``)
    }
    const msg = parts.join('\n')
    if (!msg) return

    const savedText = msg
    setText('')
    setInterimText('')
    setAttachments([])
    usedVoiceInput.current = false
    if (interimText) justSentRef.current = true // suppress late finals only when mid-utterance
    cursorPosRef.current = 0
    if (sessionName) setDraftInput(sessionName, '')

    if (isWorking) {
      // Accumulate in queue locally, then sync to server inbox so the stop
      // hook delivers it the moment the agent finishes its current turn.
      useChatStore.getState().appendQueuedMessage(sessionName, savedText)
      setSendState('queued')
      const fullQueued = useChatStore.getState().sessions[sessionName]?.queuedMessage ?? savedText
      api.setPendingMessage(sessionName, fullQueued).catch(() => {
        // Non-fatal: localStorage still holds the message; user sees "Queued" on reload.
      })
    } else {
      // Normal send — paste + Enter via the same api.sendMessage path
      setSendState('sending')
      useChatStore.getState().setPendingUserMessage(sessionName, savedText)
      try {
        await api.sendMessage(sessionName, savedText, { submit: true })
        setSendState('idle')
      } catch (err) {
        console.error('Send failed:', err)
        setText(savedText)
        if (sessionName) setDraftInput(sessionName, savedText)
        setSendState('idle')
      }
    }
  }, [sessionName, isWorking, text, interimText, attachments, setSendState, setDraftInput])

  const handleCancel = useCallback(async () => {
    if (!sessionName) return
    try {
      await api.sendCommand(sessionName, 'cancel')
      setSessionStatus(sessionName, 'idle')
    } catch (err) {
      console.error('Cancel failed:', err)
    }
  }, [sessionName, setSessionStatus])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleMicClick = useCallback(() => {
    if (!useStreamMode) {
      toggleRecording()
      return
    }
    if (muted) {
      // Muted regardless of pipeline state — unmute (toggleMute starts pipeline)
      toggleMute()
    } else if (streamState === 'idle' || streamState === 'error') {
      // Not muted but pipeline isn't running (error recovery / first start) — kick it off
      setStreamFailed(false)
      startStream()
    } else {
      // Streaming or connecting — mute
      toggleMute()
    }
  }, [useStreamMode, muted, streamState, startStream, toggleMute, toggleRecording])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    e.target.value = ''
    for (const file of files) addFile(file)
  }, [addFile])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) addFile(file)
        return
      }
    }
  }, [addFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    // Check for vault-path drag (from PM file tree) first
    const vaultPath = e.dataTransfer.getData('text/x-vault-path')
    if (vaultPath) {
      addVaultFile(vaultPath)
      return
    }

    // Fallback: OS file drop (existing behavior)
    const files = e.dataTransfer?.files
    if (!files) return
    for (const file of files) addFile(file)
  }, [addFile, addVaultFile])

  const displayValue = isStreaming && interimText
    ? (text ? `${text} ${interimText}` : interimText)
    : (text || interimText)
  const showingInterim = isStreaming && !!interimText
  const micBusy = useStreamMode ? streamState === 'connecting' : transcribing
  const anyUploading = attachments.some(a => a.uploading)

  // Voice indicator state
  const alMuted = muted
  const alListening = isStreaming && !muted && !vadSpeaking
  const alActive = isStreaming && !muted && vadSpeaking

  let placeholder = 'Ask anything'
  if (isStreaming && !muted) placeholder = 'Type or just speak...'

  return (
    <div className="chat-composer-wrap px-4 pb-3 pt-2 shrink-0 relative">
      {voiceError && <div className="absolute -top-7 left-3 text-xs text-[var(--color-red)] animate-fade-in">{voiceError}</div>}

      {/* @-mention file autocomplete */}
      {mentionOpen && (
        <MentionAutocomplete
          text={text}
          cursorPos={cursorPos}
          textareaRef={textareaRef}
          onSelect={(selection: MentionSelection) => {
            const { replaceStart: start, replaceEnd: end } = selection

            if (selection.kind === 'file') {
              const fileName = selection.path.split('/').pop() || selection.path
              const newText = text.slice(0, start) + text.slice(end)
              setText(newText)
              setMentionOpen(false)
              const newPos = start
              setCursorPos(newPos)
              if (sessionName) setDraftInput(sessionName, newText)
              addVaultFile(selection.path, fileName)
              requestAnimationFrame(() => {
                textareaRef.current?.setSelectionRange(newPos, newPos)
                textareaRef.current?.focus()
              })
            } else if (selection.kind === 'session') {
              const s = selection.session
              const lines = [
                `[Agent session: ${s.name} | ${s.task_title || s.name} | status: ${s.status || 'unknown'} | role: ${s.agent_role || 'agent'}${s.task_id ? ` | task: ${s.task_id}` : ''}`,
                s.jsonl_path ? `  JSONL: ${s.jsonl_path}` : null,
                s.task_path ? `  task_path: ${s.task_path}` : null,
                `  You can: send_agent_message(target_session="${s.name}", content="...") to message this agent${s.status === 'ended' || s.status === 'idle' ? ' (session may need to be alive)' : ''}, or read its JSONL for context.]`,
              ].filter(Boolean)
              const ref = lines.join('\n')
              const newText = text.slice(0, start) + ref + text.slice(end)
              const newPos = start + ref.length
              setText(newText)
              setCursorPos(newPos)
              setMentionOpen(false)
              if (sessionName) setDraftInput(sessionName, newText)
              requestAnimationFrame(() => {
                textareaRef.current?.setSelectionRange(newPos, newPos)
                textareaRef.current?.focus()
              })
            }
          }}
          onClose={() => {
            // Remove the @ trigger character from textarea
            const trigger = findMentionTrigger(text, cursorPos)
            if (trigger) {
              const newText = text.slice(0, trigger.start) + text.slice(trigger.start + 1 + trigger.query.length)
              setText(newText)
              setCursorPos(trigger.start)
              if (sessionName) setDraftInput(sessionName, newText)
              requestAnimationFrame(() => {
                textareaRef.current?.setSelectionRange(trigger.start, trigger.start)
              })
            }
            setMentionOpen(false)
          }}
        />
      )}

      <div
        className={cn(
          "chat-composer flex flex-col bg-[var(--bg-card)] border border-[var(--color-border)] rounded-[20px] overflow-hidden transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--color-accent)] focus-within:shadow-[var(--shadow-glow)]",
          dragOver && "border-[var(--color-accent)] shadow-[var(--shadow-glow)]"
        )}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
      >
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {attachments.map(a => (
              <div key={a.id} className={`relative rounded-md border border-[var(--color-border)] bg-[var(--bg-surface)] overflow-hidden transition-opacity duration-150 group/att ${a.uploading ? 'opacity-60' : ''} ${a.error ? 'border-[var(--color-red)] opacity-50' : ''}`}>
                {a.preview ? (
                  <img src={a.preview} alt={a.file.name} className="block h-16 max-w-[120px] object-cover rounded-md" />
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground max-w-[160px]">
                    <AppIcon name="file" size={14} />
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">{a.file.name}</span>
                  </div>
                )}
                {a.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-transparent border-t-[var(--color-accent)] rounded-full animate-spin-fast" />
                  </div>
                )}
                <IconButton
                  variant="overlay"
                  size="file"
                  shape="round"
                  className="absolute top-0.5 right-0.5 opacity-0 transition-opacity duration-150 group-hover/att:opacity-100"
                  onClick={() => removeAttachment(a.id)}
                  title="Remove"
                >
                  <AppIcon name="x" size={12} />
                </IconButton>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={e => {
            if (showingInterim) return
            const val = e.target.value
            const pos = e.target.selectionStart ?? val.length
            setText(val)
            setCursorPos(pos)
            setMentionOpen(!!findMentionTrigger(val, pos))
            setInterimText('')
            if (sessionName) setDraftInput(sessionName, val)
          }}
          onSelect={e => {
            if (showingInterim) return
            const pos = (e.target as HTMLTextAreaElement).selectionStart ?? 0
            setCursorPos(pos)
            setMentionOpen(!!findMentionTrigger(text, pos))
          }}
          onKeyDown={e => {
            if (showingInterim) {
              // Only allow Enter to send during interim
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
              return
            }
            // Close mention popup on Escape
            if (e.key === 'Escape' && mentionOpen) {
              e.preventDefault()
              setMentionOpen(false)
              return
            }
            handleKeyDown(e)
          }}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={1}
          autoComplete="off"
          data-form-type="other"
          data-1p-ignore
          data-lpignore="true"
          className={`chat-composer-textarea w-full bg-transparent border-none px-4 pt-3.5 pb-1 text-foreground type-title-sm font-[inherit] resize-none outline-none min-h-7 max-h-40 leading-normal placeholder:text-muted-foreground ${showingInterim ? 'text-muted-foreground italic pointer-events-none select-none' : ''}`}
        />

        {/* Toolbar row */}
        <div className="chat-composer-toolbar flex items-center justify-between px-2 pb-2 pt-1 min-h-9">
          <div className="flex items-center gap-0.5">
            <FileSearchPicker
              open={filePickerOpen}
              onOpenChange={setFilePickerOpen}
              onSelect={(path, name) => {
                addVaultFile(path, name)
                setFilePickerOpen(false)
              }}
              onUploadClick={() => {
                setFilePickerOpen(false)
                fileInputRef.current?.click()
              }}
            >
              <IconButton
                variant="input"
                size="input"
                className="chat-composer-icon chat-composer-attach"
                onClick={() => setFilePickerOpen(!filePickerOpen)}
                disabled={anyUploading}
                title="Attach file"
              >
                <AppIcon name="attach" size={18} />
              </IconButton>
            </FileSearchPicker>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.md,.txt,.json,.csv,.yaml,.yml,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.sh,.sql"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {isWorking && sendState !== 'queued' && (
              <ActionButton
                variant="panel"
                size="sm"
                onClick={handleCancel}
                className="h-7 rounded-lg border-[rgba(224,90,75,0.4)] text-[var(--color-red)] hover:bg-[rgba(224,90,75,0.15)] hover:text-[var(--color-red)]"
                title="Cancel agent"
              >
                Cancel
              </ActionButton>
            )}
            {sendState === 'queued' && (
              <span className="text-xs text-muted-foreground px-2">Queued</span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {voiceEnabled && (
              <IconButton
                variant="input"
                size="input"
                onClick={handleMicClick}
                disabled={micBusy}
                className={cn(
                  'chat-composer-icon chat-composer-mic',
                  alMuted && 'text-muted-foreground hover:bg-[var(--bg-ingrained)] hover:text-foreground',
                  alListening && 'text-muted-foreground animate-live-ring-breathe',
                  alActive && 'text-[rgb(94,186,171)] animate-live-ring-active',
                )}
                title={muted ? 'Unmute mic' : (vadSpeaking ? 'Hearing you...' : 'Listening — click to mute')}
              >
                <AppIcon name={alMuted ? 'mic-off' : 'mic'} size={18} />
              </IconButton>
            )}

            <IconButton
              variant="inputPrimary"
              size="input"
              className="chat-composer-icon chat-composer-send"
              onClick={handleSend}
              disabled={sendState === 'sending' || anyUploading}
              title="Send"
            >
              <AppIcon name="send" size={18} strokeWidth={2.5} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  )
})

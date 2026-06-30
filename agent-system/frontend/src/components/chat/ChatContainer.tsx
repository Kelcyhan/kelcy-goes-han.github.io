import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import { useChatStore, groupMessagesIntoTurns, findLastAnchorUuid, EMPTY_MESSAGES } from '@/stores/chat-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { TurnGroup } from '@/components/chat/TurnGroup.tsx'
import { useStreamWebSocket } from '@/hooks/useStreamWs.ts'
import type { InputBarHandle } from '@/components/chat/InputBar.tsx'
import * as api from '@/lib/api.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import { ActionButton, AppIcon, IconButton, type AppIconName } from '@/components/primitives'

const STARTER_PROMPTS = [
  { icon: 'project', label: 'Create a project for...', message: 'Help me create a new project. Ask me what I want to work on.' },
  { icon: 'book', label: 'Plan a literature review', message: 'Help me plan a literature review on a topic I\'ll describe.' },
  { icon: 'sparkles', label: 'What can you do?', message: 'What can you help me with? Give me a quick overview of what this system does.' },
]

interface ChatContainerProps {
  sessionName: string
  inputBarRef?: RefObject<InputBarHandle | null>
  compact?: boolean
}

function isHelperStartupPrompt(sessionName: string, msg: typeof EMPTY_MESSAGES[number]) {
  if (!sessionName.startsWith('helper_')) return false
  if (msg.type !== 'user') return false
  const text = msg.content?.find(b => b.type === 'text')?.text ?? ''
  return text.startsWith('[System] Your tmux session name is: helper_')
    && text.includes('--- Your Agent Instructions ---')
}

export function ChatContainer({ sessionName, inputBarRef, compact }: ChatContainerProps) {
  // Read per-session state
  const messages = useChatStore(s => s.sessions[sessionName]?.messages ?? EMPTY_MESSAGES)
  const queuedMessage = useChatStore(s => s.sessions[sessionName]?.queuedMessage ?? null)
  const pendingUserMessage = useChatStore(s => s.sessions[sessionName]?.pendingUserMessage ?? null)
  const visibleMessages = useMemo(
    () => messages.filter(msg => !isHelperStartupPrompt(sessionName, msg)),
    [messages, sessionName],
  )
  const turns = useMemo(() => groupMessagesIntoTurns(visibleMessages), [visibleMessages])
  const sessionStatus = useSessionStore(s => s.sessionStatuses[sessionName] ?? 'unknown')
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const restoringScrollRef = useRef(false)
  const pendingInitialScrollRef = useRef<number | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Connect WebSocket stream
  useStreamWebSocket(sessionName)

  // On mount: restore scroll position saved from a previous session visit
  useEffect(() => {
    const el = containerRef.current
    if (!el || !sessionName) return
    const saved = useWorkspaceStore.getState().getScrollPosition(sessionName)
    pendingInitialScrollRef.current = saved != null && saved > 0 ? saved : null
    if (saved != null && saved > 0 && visibleMessages.length > 0) {
      restoringScrollRef.current = true
      requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.scrollTop = saved
        requestAnimationFrame(() => { restoringScrollRef.current = false })
      })
    }
  }, [sessionName, visibleMessages.length])

  // Save scroll on hide, restore on show (tab switches within same page load)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!sessionName) return
      if (entry.isIntersecting) {
        // Panel becoming visible — restore saved position
        const saved = useWorkspaceStore.getState().getScrollPosition(sessionName)
        if (saved != null && saved > 0) {
          restoringScrollRef.current = true
          requestAnimationFrame(() => {
            el.scrollTop = saved
            requestAnimationFrame(() => {
              restoringScrollRef.current = false
            })
          })
        }
      } else {
        // Panel being hidden — save current position before it's lost
        if (el.scrollTop > 0) {
          useWorkspaceStore.getState().setScrollPosition(sessionName, el.scrollTop)
        }
      }
    }, { threshold: 0.01 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [sessionName])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      })
    })
  }, [])

  // Scroll to bottom on initial history load
  const historyLoadedRef = useRef(false)
  useEffect(() => {
    const prevCount = prevMessageCountRef.current
    const newCount = visibleMessages.length
    prevMessageCountRef.current = newCount

    // First time messages appear (history loaded):
    // 1. saved scroll position — restore (respects user's last position)
    // 2. else — anchor on the last non-bootstrap finalMsg so SessionStart hook
    //    scaffolding doesn't bury the prior real content
    // 3. else — fall back to scrollToBottom (fresh session, nothing to anchor on)
    if (!historyLoadedRef.current && newCount > 0) {
      historyLoadedRef.current = true
      const saved = pendingInitialScrollRef.current
      if (saved != null) {
        restoringScrollRef.current = true
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = saved
            const el = containerRef.current
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
            autoScrollRef.current = distFromBottom < 50
            setShowScrollBtn(distFromBottom > 200)
          }
          requestAnimationFrame(() => { restoringScrollRef.current = false })
        })
      } else {
        const anchorUuid = findLastAnchorUuid(turns)
        if (anchorUuid) {
          restoringScrollRef.current = true
          requestAnimationFrame(() => {
            const node = containerRef.current?.querySelector(
              `[data-msg-uuid="${anchorUuid}"]`,
            ) as HTMLElement | null
            if (node) {
              node.scrollIntoView({ block: 'start' })
            } else if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight
            }
            requestAnimationFrame(() => { restoringScrollRef.current = false })
          })
        } else {
          scrollToBottom()
        }
      }
      return
    }

    // New messages arriving while auto-scroll is on
    if (newCount > prevCount && autoScrollRef.current) {
      scrollToBottom()
    }
  }, [turns, queuedMessage, pendingUserMessage, scrollToBottom, visibleMessages.length])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    if (el.offsetParent === null) return
    if (restoringScrollRef.current) return
    if (visibleMessages.length === 0) return

    if (sessionName) useWorkspaceStore.getState().setScrollPosition(sessionName, el.scrollTop)
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    autoScrollRef.current = distFromBottom < 50
    setShowScrollBtn(distFromBottom > 200)
  }

  const handleScrollToBottom = useCallback(() => {
    autoScrollRef.current = true
    setShowScrollBtn(false)
    const el = containerRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    autoScrollRef.current = true
  }, [sessionName])

  const handleInterruptAndSend = useCallback(async () => {
    if (!sessionName || !queuedMessage) return
    const msg = queuedMessage
    useChatStore.getState().setQueuedMessage(sessionName, null)
    useChatStore.getState().setSendState(sessionName, 'idle')
    // Clear inbox before cancelling so the stop hook doesn't deliver the old queued message
    await api.clearPendingMessage(sessionName).catch(() => {})
    await api.sendCommand(sessionName, 'cancel')
    await new Promise(r => setTimeout(r, 300))
    useChatStore.getState().setPendingUserMessage(sessionName, msg)
    await api.sendMessage(sessionName, msg, { submit: true })
  }, [sessionName, queuedMessage])

  const handleEditQueued = useCallback(() => {
    if (!sessionName || !queuedMessage) return
    inputBarRef?.current?.restoreText(queuedMessage)
    useChatStore.getState().setQueuedMessage(sessionName, null)
    useChatStore.getState().setSendState(sessionName, 'idle')
    api.clearPendingMessage(sessionName).catch(() => {})
  }, [sessionName, queuedMessage, inputBarRef])

  return (
    <div className={`chat-shell flex-1 min-h-0 relative flex flex-col ${compact ? 'chat-compact' : ''}`}>
      <div
        ref={containerRef}
        data-chat-scroll-session={sessionName}
        onScroll={handleScroll}
        className="chat-scroll flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 flex flex-col gap-3 min-h-0 bg-transparent"
      >
        {/* Starter prompts for empty concierge sessions */}
        {turns.length === 0 && sessionStatus !== 'working' && sessionName.startsWith('concierge_') && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 py-10">
            <AppIcon name="chat" size={28} className="text-muted-foreground opacity-40" />
            <span className="type-body-sm text-muted-foreground">How can I help?</span>
            <div className="flex flex-col gap-2 w-full max-w-[320px]">
              {STARTER_PROMPTS.map((sp) => {
                return (
                  <ActionButton
                    variant="secondary"
                    size="default"
                    key={sp.label}
                    className="justify-start gap-2.5 rounded-lg px-3.5 py-2.5 text-left"
                    onClick={async () => {
                      useChatStore.getState().setPendingUserMessage(sessionName, sp.message)
                      await api.sendMessage(sessionName, sp.message, { submit: true })
                    }}
                  >
                    <AppIcon name={sp.icon as AppIconName} size={15} className="text-accent shrink-0" />
                    <span className="type-label text-foreground">{sp.label}</span>
                  </ActionButton>
                )
              })}
            </div>
          </div>
        )}

        {turns.map((turn, i) => {
          const key = turn.userMsg?.uuid || turn.steps[0]?.uuid || turn.finalMsg?.uuid || `turn-${i}`
          return <TurnGroup key={key} turn={turn} />
        })}

        {/* Pending user message — optimistic render before JSONL confirms */}
        {pendingUserMessage && !queuedMessage && (
          <div className="chat-user-bubble chat-user-bubble-pending self-end max-w-[85%] min-w-0 my-1 animate-fade-in px-3.5 py-2.5 bg-[var(--color-accent-dim)] border border-[var(--color-border-accent)] rounded-[12px_12px_4px] opacity-60">
            <div className="text-sm leading-normal text-foreground whitespace-pre-wrap break-words">{pendingUserMessage}</div>
          </div>
        )}

        {/* Queued message bubble */}
        {queuedMessage && (
          <div className="chat-user-bubble chat-queued-bubble self-end max-w-[85%] my-1 animate-fade-in px-3.5 py-2.5 bg-[var(--color-accent-dim)] rounded-[12px_12px_4px] opacity-60 border border-dashed border-[var(--color-accent)]">
            <div className="type-micro text-muted-foreground mb-1 uppercase tracking-[0.5px]">Queued</div>
            <div className="text-sm leading-normal text-foreground whitespace-pre-wrap">{queuedMessage}</div>
            <div className="flex gap-2 mt-2">
              <ActionButton variant="toolbarPrimary" size="toolbar" onClick={handleInterruptAndSend}>Interrupt &amp; send</ActionButton>
              <ActionButton variant="toolbar" size="toolbar" onClick={handleEditQueued}>Edit</ActionButton>
            </div>
          </div>
        )}

        {/* Working indicator */}
        {sessionStatus === 'working' && (
          <div className="chat-working-pill self-start flex items-center gap-[6px] px-3 py-[5px] my-1 rounded-full bg-[var(--bg-card)] border border-[var(--color-border-subtle)] text-xs text-muted-foreground animate-fade-in">
            <div className="thk-spinner" />working...
          </div>
        )}
      </div>

      {showScrollBtn && (
        <IconButton
          variant="copy"
          size="lg"
          shape="round"
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 animate-fade-in shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
          onClick={handleScrollToBottom}
          title="Scroll to bottom"
        >
          <AppIcon name="scroll-bottom" size={20} />
        </IconButton>
      )}
    </div>
  )
}

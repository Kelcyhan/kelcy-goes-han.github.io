import { create } from 'zustand'
import type { Message, Turn } from '@/lib/types.ts'
import * as api from '@/lib/api.ts'

/** Per-session chat state. Each agent panel reads its own session's data. */
export type SendState = 'idle' | 'sending' | 'queued'

export interface SessionChat {
  messages: Message[]
  cursor: string | null
  totalInputTokens: number
  totalOutputTokens: number
  contextTokens: number
  model: string | null
  headerInfo: string
  queuedMessage: string | null
  sendState: SendState
  pendingUserMessage: string | null
}

const EMPTY_SESSION: SessionChat = {
  messages: [],
  cursor: null,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  contextTokens: 0,
  model: null,
  headerInfo: '',
  queuedMessage: null,
  sendState: 'idle',
  pendingUserMessage: null,
}

/** Stable empty array — avoids creating new [] references in selectors. */
export const EMPTY_MESSAGES: Message[] = []

interface ChatStore {
  /** All session chat states, keyed by session name. */
  sessions: Record<string, SessionChat>

  /** Get or create a session's chat state. */
  getSession: (name: string) => SessionChat

  loadHistory: (name: string) => Promise<void>
  loadHistoryFromJsonl: (name: string, jsonlPath: string) => Promise<void>
  ensureSession: (name: string) => void
  addMessages: (name: string, msgs: Message[], lastUuid: string) => void
  updateTokens: (name: string, input: number, output: number) => void
  setContextTokens: (name: string, tokens: number) => void
  setModel: (name: string, model: string) => void
  setHeaderInfo: (name: string, info: string) => void
  setQueuedMessage: (name: string, msg: string | null) => void
  appendQueuedMessage: (name: string, msg: string) => void
  setSendState: (name: string, state: SendState) => void
  setPendingUserMessage: (name: string, msg: string | null) => void
  clearSession: (name: string) => void
  removeSession: (name: string) => void
}

export function groupMessagesIntoTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = []
  let currentTurn: Turn | null = null

  for (const msg of messages) {
    if (msg.subtype) {
      // agent_message (peer-from-another-agent) opens a new turn in chronological
      // position, mirroring how a real user-text message would. Rendered as PeerMessage.
      if (msg.subtype === 'agent_message') {
        if (currentTurn) turns.push(currentTurn)
        currentTurn = { userMsg: msg, steps: [], finalMsg: null }
        continue
      }
      // Other meta messages (hooks, local commands, task notifications, system_prompt,
      // interrupt) go into steps — they're scaffolding, not user input.
      if (!currentTurn) {
        currentTurn = { userMsg: null, steps: [], finalMsg: null }
      }
      currentTurn.steps.push(msg)
      continue
    }

    const isUserText =
      msg.type === 'user' && msg.content?.some(b => b.type === 'text')

    if (isUserText) {
      if (currentTurn) turns.push(currentTurn)
      currentTurn = { userMsg: msg, steps: [], finalMsg: null }
      continue
    }

    if (!currentTurn) {
      currentTurn = { userMsg: null, steps: [], finalMsg: null }
    }
    currentTurn.steps.push(msg)
  }

  if (currentTurn) turns.push(currentTurn)

  for (const turn of turns) {
    for (let i = turn.steps.length - 1; i >= 0; i--) {
      const s = turn.steps[i]
      if (s.type === 'assistant' && s.content?.some(b => b.type === 'text')) {
        turn.finalMsg = s
        turn.steps.splice(i, 1)
        break
      }
    }
  }

  return turns
}

/** Detect a "session bootstrap" turn — SessionStart hook + tool-only steps + a
 *  short mechanical finalMsg ("Session ID recorded", "Done", etc.). These exist
 *  for record-keeping; the user never needs to see them as primary content.
 */
const MECHANICAL_BOOTSTRAP_TEXT = /^(Session ID recorded|Recorded\.?|Done\.?|Acknowledged\.?)\b/i

export function isBootstrapTurn(turn: Turn): boolean {
  if (turn.userMsg !== null) return false
  // Steps may contain bookkeeping scaffolding (system_prompt/hook subtypes,
  // tool_use/tool_result for the YAML edit, thinking blocks, short intermediate
  // assistant text like "Recording session ID..."). Substantive non-bootstrap
  // content is detected by the FINAL message check below — if the finalMsg is
  // mechanical, the rest of the turn is by definition bookkeeping.
  for (const s of turn.steps) {
    if (s.subtype) {
      if (s.subtype !== 'system_prompt' && s.subtype !== 'hook') return false
      continue
    }
    const blocks = s.content || []
    if (blocks.length === 0) continue
    if (!blocks.every(b => b.type === 'tool_use' || b.type === 'tool_result' || b.type === 'thinking' || b.type === 'text')) return false
  }
  const finalText = turn.finalMsg?.content
    ?.filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text).join('\n').trim() ?? ''
  if (!finalText) return false
  if (MECHANICAL_BOOTSTRAP_TEXT.test(finalText)) return true
  if (finalText.length < 200 && /session\s*ID|session_ids/i.test(finalText)) return true
  return false
}

/** Last non-bootstrap finalMsg UUID — the visible "anchor" we want on first
 *  history load when no saved scroll position exists. */
export function findLastAnchorUuid(turns: Turn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (!isBootstrapTurn(turns[i]) && turns[i].finalMsg?.uuid) {
      return turns[i].finalMsg!.uuid
    }
  }
  return null
}

/** Helper: update a single session's state within the store. */
function updateSession(
  set: (fn: (s: ChatStore) => Partial<ChatStore>) => void,
  _get: () => ChatStore,
  name: string,
  patch: Partial<SessionChat>,
) {
  set(s => ({
    sessions: {
      ...s.sessions,
      [name]: { ...(s.sessions[name] ?? EMPTY_SESSION), ...patch },
    },
  }))
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: {},

  getSession: (name) => get().sessions[name] ?? EMPTY_SESSION,

  ensureSession: (name) => {
    if (!get().sessions[name]) {
      set(s => ({ sessions: { ...s.sessions, [name]: { ...EMPTY_SESSION } } }))
      get().loadHistory(name)
    }
  },

  loadHistory: async (name) => {
    try {
      const data = await api.fetchMessages(name)
      let totalIn = 0, totalOut = 0, ctx = 0
      let model: string | null = null
      for (const msg of data.messages) {
        if (msg.type === 'assistant') {
          if (msg.model) model = msg.model
          if (msg.usage) {
            totalIn += msg.usage.input_tokens || 0
            totalOut += msg.usage.output_tokens || 0
            ctx = (msg.usage.input_tokens || 0)
              + (msg.usage.cache_creation_input_tokens || 0)
              + (msg.usage.cache_read_input_tokens || 0) || ctx
          }
        }
      }

      // If a queued message exists (in-store or localStorage), check whether it
      // was already delivered by searching the loaded history for a matching user
      // text message. This handles the case where delivery happened while the
      // panel was closed, so the WebSocket cursor is already past the delivery.
      let localQueued: string | null = null
      try { localQueued = localStorage.getItem(`queue_${name}`) } catch {}
      const queued = get().sessions[name]?.queuedMessage ?? localQueued
      let clearQueue = false
      if (queued) {
        clearQueue = data.messages.some(m =>
          m.type === 'user' &&
          m.content?.some((b: { type: string; text?: string }) => b.type === 'text' && b.text === queued)
        )
        if (clearQueue) {
          try { localStorage.removeItem(`queue_${name}`) } catch {}
        }
      }

      updateSession(set, get, name, {
        messages: data.messages,
        cursor: data.last_uuid || null,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        contextTokens: ctx,
        model,
        headerInfo: `${data.count} messages`,
        ...(clearQueue ? { queuedMessage: null, pendingUserMessage: null, sendState: 'idle' as const } : {}),
      })
    } catch (err) {
      console.error('Failed to load history:', err)
      updateSession(set, get, name, { headerInfo: 'Failed to load' })
    }
  },

  loadHistoryFromJsonl: async (name, jsonlPath) => {
    try {
      const data = await api.fetchHistoryMessages(jsonlPath)
      let totalIn = 0, totalOut = 0, ctx = 0
      let model: string | null = null
      for (const msg of data.messages) {
        if (msg.type === 'assistant') {
          if (msg.model) model = msg.model
          if (msg.usage) {
            totalIn += msg.usage.input_tokens || 0
            totalOut += msg.usage.output_tokens || 0
            ctx = (msg.usage.input_tokens || 0)
              + (msg.usage.cache_creation_input_tokens || 0)
              + (msg.usage.cache_read_input_tokens || 0) || ctx
          }
        }
      }
      updateSession(set, get, name, {
        messages: data.messages,
        cursor: data.last_uuid || null,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        contextTokens: ctx,
        model,
        headerInfo: `${data.count} messages (past)`,
      })
    } catch (err) {
      console.error('Failed to load JSONL history:', err)
      updateSession(set, get, name, { headerInfo: 'Failed to load past session' })
    }
  },

  addMessages: (name, msgs, lastUuid) => {
    const session = get().sessions[name] ?? EMPTY_SESSION
    const existingUuids = new Set(session.messages.map(m => m.uuid).filter(Boolean))
    const newMsgs = msgs.filter(m => !m.uuid || !existingUuids.has(m.uuid))
    if (newMsgs.length === 0 && !lastUuid) return
    let ctx = session.contextTokens
    for (const msg of newMsgs) {
      if (msg.type === 'assistant' && msg.usage) {
        ctx = (msg.usage.input_tokens || 0)
          + (msg.usage.cache_creation_input_tokens || 0)
          + (msg.usage.cache_read_input_tokens || 0) || ctx
      }
    }
    // A real user text message means either the user sent something normally or
    // the stop hook delivered a queued message. Either way, clear pending + queue.
    // Tool-result messages also have type='user' but have content[].type='tool_result',
    // so we distinguish by checking for a text block.
    const hasNewUserTextMsg = newMsgs.some(m =>
      m.type === 'user' && m.content?.some((b: { type: string }) => b.type === 'text')
    )
    updateSession(set, get, name, {
      messages: [...session.messages, ...newMsgs],
      cursor: lastUuid || session.cursor,
      contextTokens: ctx,
      ...(hasNewUserTextMsg ? {
        pendingUserMessage: null,
        queuedMessage: null,
        sendState: 'idle' as const,
      } : {}),
    })
    // Also clear localStorage queue key when delivery is confirmed
    if (hasNewUserTextMsg) {
      try { localStorage.removeItem(`queue_${name}`) } catch {}
    }
  },

  updateTokens: (name, input, output) =>
    updateSession(set, get, name, { totalInputTokens: input, totalOutputTokens: output }),

  setContextTokens: (name, tokens) =>
    updateSession(set, get, name, { contextTokens: tokens }),

  setModel: (name, model) =>
    updateSession(set, get, name, { model }),

  setHeaderInfo: (name, info) =>
    updateSession(set, get, name, { headerInfo: info }),

  setQueuedMessage: (name, msg) => {
    updateSession(set, get, name, { queuedMessage: msg })
    if (msg === null) {
      try { localStorage.removeItem(`queue_${name}`) } catch {}
    } else {
      try { localStorage.setItem(`queue_${name}`, msg) } catch {}
    }
  },

  appendQueuedMessage: (name, msg) => {
    const existing = get().sessions[name]?.queuedMessage
    const updated = existing ? existing + '\n' + msg : msg
    updateSession(set, get, name, { queuedMessage: updated })
    try { localStorage.setItem(`queue_${name}`, updated) } catch {}
  },

  setSendState: (name, state) =>
    updateSession(set, get, name, { sendState: state }),

  setPendingUserMessage: (name, msg) =>
    updateSession(set, get, name, { pendingUserMessage: msg }),

  clearSession: (name) =>
    updateSession(set, get, name, { ...EMPTY_SESSION }),

  removeSession: (name) => {
    set(s => {
      const { [name]: _, ...rest } = s.sessions
      return { sessions: rest }
    })
  },
}))

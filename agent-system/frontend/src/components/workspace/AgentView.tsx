import { useEffect, useState, useRef } from 'react'
import { useTabStore } from '@/stores/tab-store.ts'
import type { AgentTabData } from '@/stores/tab-store.ts'
import { useChatStore } from '@/stores/chat-store.ts'
import { useSessionStore } from '@/stores/session-store.ts'
import { ChatContainer } from '@/components/chat/ChatContainer.tsx'
import { ReadOnlyChatContainer } from '@/components/chat/ReadOnlyChatContainer.tsx'
import { TerminalPanel } from '@/components/terminal/TerminalPanel.tsx'
import { InputBar } from '@/components/chat/InputBar.tsx'
import type { InputBarHandle } from '@/components/chat/InputBar.tsx'
import { StatusBar } from '@/components/chat/StatusBar.tsx'
import { StatusDot } from '@/components/primitives'
import { Badge } from '@/components/ui/badge.tsx'
import { RotateCcw, Monitor } from 'lucide-react'
import { getDockviewApi } from '@/stores/tab-store.ts'
import * as api from '@/lib/api.ts'

interface AgentViewProps {
  panelId: string
  sessionName: string
  tab: AgentTabData
}

export function AgentView({ panelId, sessionName, tab }: AgentViewProps) {
  const inputBarRef = useRef<InputBarHandle>(null)
  const setInnerTab = useTabStore(s => s.setInnerTab)
  const openBrowserTab = useTabStore(s => s.openBrowserTab)
  const sessionStatus = useSessionStore(s => s.sessionStatuses[sessionName] ?? 'unknown')
  const session = useSessionStore(s => s.sessions.find(sess => sess.name === sessionName))
  const isSessionAlive = !!session
  const isReadOnly = tab.readOnly === true || !isSessionAlive
  // Browser button is always shown when the session is alive. The context
  // may not exist yet — clicking opens the Browser tab, which then asks the
  // agent to allocate the playwright context (see BrowserView init prompt).
  const showBrowserButton = !isReadOnly

  // For past sessions, load history from JSONL on mount
  useEffect(() => {
    if (isReadOnly && tab.jsonlPath) {
      useChatStore.getState().loadHistoryFromJsonl(sessionName, tab.jsonlPath)
    }
  }, [isReadOnly, tab.jsonlPath, sessionName])

  const [resuming, setResuming] = useState(false)
  const needsInput = !isReadOnly && sessionStatus === 'waiting_input' && tab.innerTab !== 'terminal'
  const canResume = !isSessionAlive && isReadOnly && tab.sessionUuid && (tab.resumeWorkingDir || tab.taskPath)

  const handleResume = async () => {
    const workingDir = tab.resumeWorkingDir || tab.taskPath
    if (!tab.sessionUuid || !workingDir) return
    setResuming(true)
    try {
      const result = await api.spawnTaskAgent({
        working_dir: workingDir,
        resume_session_id: tab.sessionUuid,
      })
      useSessionStore.getState().setActiveSession(result.session_name)
      // Switch this tab to the new live session
      useTabStore.getState().openAgentTab(result.session_name)
      // Close this read-only tab
      handleClose()
    } catch (err) {
      console.error('Failed to resume session:', err)
      setResuming(false)
    }
  }

  const handleClose = () => {
    const dv = getDockviewApi()
    const panel = dv?.getPanel(panelId)
    panel?.api.close()
  }


  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-1.5 min-h-[40px] shrink-0 border-b border-[var(--color-border-subtle)] text-xs">
        {isReadOnly ? (
          <>
            <span className="font-mono text-accent-foreground font-semibold">{sessionName}</span>
            <Badge variant="default">past session</Badge>
          </>
        ) : (
          <>
            <span className="text-muted-foreground font-medium">{session?.agent_role || 'agent session'}</span>
            {session?.task_id && (
              <>
                <span className="text-[var(--color-text-subtle)]">&middot;</span>
                <span className="text-accent-foreground font-semibold truncate">{session.task_title || 'Active task'}</span>
              </>
            )}
          </>
        )}

        {showBrowserButton && (
          <button
            className="flex items-center gap-1 px-2 py-1 rounded type-micro text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-2)] transition-colors ml-auto shrink-0"
            title="View live browser"
            onClick={openBrowserTab}
          >
            <Monitor size={12} />
            <span>Browser</span>
          </button>
        )}
        {!isReadOnly && (
          <div className={`flex bg-[var(--bg-ingrained)] rounded-full p-0.5 gap-px shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] shrink-0 ${showBrowserButton ? '' : 'ml-auto'}`}>
            <button
              className={`flex items-center gap-[5px] bg-transparent border-none text-muted-foreground cursor-pointer text-xs font-medium px-3.5 h-[26px] rounded-full transition-colors duration-150 whitespace-nowrap hover:text-foreground ${tab.innerTab === 'chat' ? 'bg-[var(--bg-panel)] text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.25)]' : ''}`}
              onClick={() => setInnerTab(panelId, 'chat')}
            >
              Chat
              {sessionStatus === 'working' && tab.innerTab !== 'chat' && (
                <StatusDot status="working" size="sm" className="ml-1" />
              )}
            </button>
            <button
              className={`flex items-center gap-[5px] bg-transparent border-none text-muted-foreground cursor-pointer text-xs font-medium px-3.5 h-[26px] rounded-full transition-colors duration-150 whitespace-nowrap hover:text-foreground ${tab.innerTab === 'terminal' ? 'bg-[var(--bg-panel)] text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.25)]' : ''} ${needsInput ? 'text-orange' : ''}`}
              onClick={() => setInnerTab(panelId, 'terminal')}
              title={needsInput ? 'Agent is waiting for your input' : undefined}
            >
              Terminal
              {needsInput && <StatusDot status="waiting" size="sm" className="ml-1" />}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {isReadOnly ? (
          <ReadOnlyChatContainer sessionName={sessionName} />
        ) : (
          <>
            {tab.innerTab === 'chat' && <ChatContainer sessionName={sessionName} inputBarRef={inputBarRef} />}
            {tab.innerTab === 'terminal' && <TerminalPanel sessionName={sessionName} />}
          </>
        )}
      </div>

      {isReadOnly && canResume && (
        <div className="flex justify-center px-4 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--bg-surface)]">
          <button
            className="flex items-center gap-2 px-5 py-2 rounded-md border border-accent text-accent type-body-sm type-medium cursor-pointer bg-transparent transition-all duration-150 hover:bg-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleResume}
            disabled={resuming}
          >
            <RotateCcw size={14} />
            {resuming ? 'Resuming...' : 'Resume Session'}
          </button>
        </div>
      )}

      {!isReadOnly && (
        <>
          <StatusBar sessionName={sessionName} />
          <InputBar ref={inputBarRef} sessionName={sessionName} />
        </>
      )}
    </div>
  )
}

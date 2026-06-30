import { useRef, useEffect } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useTerminal } from '@/hooks/useTerminal.ts'

interface TerminalPanelProps {
  sessionName: string
}

export function TerminalPanel({ sessionName }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { init, connectWs, destroy } = useTerminal(sessionName)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!sessionName || !containerRef.current) return
    if (initializedRef.current) return

    const timer = setTimeout(() => {
      if (!containerRef.current) return
      init(containerRef.current, () => connectWs(sessionName))
      initializedRef.current = true
    }, 50)

    return () => {
      clearTimeout(timer)
      destroy()
      initializedRef.current = false
    }
  }, [sessionName, init, connectWs, destroy])

  return (
    <div className="terminal-container">
      <div ref={containerRef} className="terminal-inner" />
    </div>
  )
}

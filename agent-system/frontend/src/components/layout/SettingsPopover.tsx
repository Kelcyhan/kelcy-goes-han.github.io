import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { ClaudeAuthDock } from '@/components/auth/ClaudeAuthDock.tsx'
import { AISettingsDialog } from '@/components/settings/AISettingsDialog.tsx'
import { LLMSettingsPanel } from '@/components/settings/LLMSettingsPanel.tsx'
import { IconButton, SegmentedControl } from '@/components/primitives'

interface SettingsPopoverProps {
  open: boolean
  onClose: () => void
}

const AUTONOMY_KEY = 'agent-autonomy-level'

export function SettingsPopover({ open, onClose }: SettingsPopoverProps) {
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [autonomy, setAutonomy] = useState<'low' | 'high'>(() => {
    try { return (localStorage.getItem(AUTONOMY_KEY) as 'low' | 'high') || 'low' } catch { return 'low' }
  })

  const handleAutonomy = (level: 'low' | 'high') => {
    setAutonomy(level)
    try { localStorage.setItem(AUTONOMY_KEY, level) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.settings-popover') && !target.closest('.settings-trigger')) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="settings-popover">
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <IconButton variant="appShell" size="file" onClick={onClose} title="Close settings">
            <X size={12} />
          </IconButton>
        </div>

        <div className="settings-row no-border">
          <div>
            <span className="settings-label">Autonomy</span>
            <div className="settings-hint">
              {autonomy === 'low' ? 'Agents ask for approval' : 'Agents act automatically'}
            </div>
          </div>
          <SegmentedControl
            className="w-[132px] shrink-0"
            items={[
              { id: 'low', label: 'Low' },
              { id: 'high', label: 'High' },
            ]}
            value={autonomy}
            onValueChange={(id) => handleAutonomy(id as 'low' | 'high')}
          />
        </div>

        <div className="settings-section-label">Provider Auth</div>
        <div className="settings-auth-embed">
          <ClaudeAuthDock embedded />
        </div>

        <div className="settings-section-label">AI Settings</div>
        <div className="settings-auth-embed">
          <LLMSettingsPanel compact onOpenAdvanced={() => setAiSettingsOpen(true)} />
        </div>
      </div>
      <AISettingsDialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen} />
    </>
  )
}

import { Compass } from 'lucide-react'
import * as api from '@/lib/api.ts'
import {
  FloatingChatWidget,
  type FloatingChatVariantConfig,
} from '@/components/floating-chat/FloatingChatWidget.tsx'

const CONCIERGE_CONFIG: FloatingChatVariantConfig = {
  variant: 'concierge',
  storageKeys: {
    // Persist session_name like the helper does — one concierge per browser
    // until the user explicitly clicks Close. Avoids accumulating orphaned
    // concierge sessions on every page reload.
    session: 'concierge-session-name',
    position: 'concierge-position',
    size: 'concierge-size',
  },
  fabColor: 'var(--color-green-deep)',
  fabColorHover: 'color-mix(in srgb, var(--color-green-deep) 78%, white 22%)',
  Icon: Compass,
  iconSize: 13,
  title: 'Concierge',
  subtitle: 'Routes you to the right place',
  chips: [
    { icon: '🧭', label: "What's up?", msg: 'Brief me on what happened recently and what I should look at next.', tip: 'Get a briefing on recent activity' },
    { icon: '🎯', label: 'Pick a task', msg: 'Help me decide what to work on next.', tip: 'Decide what to focus on' },
    { icon: '📂', label: 'Find something', msg: 'Help me find ', tip: 'Locate a project, task, or note' },
    { icon: '🪄', label: 'New project', msg: 'Help me start a new project on ', tip: 'Scaffold a new project' },
  ],
  sessionCreator: api.createConciergeSession,
  stackIndex: 1,
  ariaLabel: 'Open concierge',
  fabTitle: 'Concierge — drag to move',
  closeTitle: 'Close — ends this concierge session',
  closeDialog: {
    title: 'Close "Concierge"?',
    description: 'End this session. Next open spawns a fresh concierge.',
  },
}

export function ConciergeWidget() {
  return <FloatingChatWidget config={CONCIERGE_CONFIG} />
}

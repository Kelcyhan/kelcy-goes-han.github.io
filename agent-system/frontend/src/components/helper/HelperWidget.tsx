import { MessageCircle } from 'lucide-react'
import * as api from '@/lib/api.ts'
import {
  FloatingChatWidget,
  type FloatingChatVariantConfig,
} from '@/components/floating-chat/FloatingChatWidget.tsx'

const HELPER_CONFIG: FloatingChatVariantConfig = {
  variant: 'helper',
  storageKeys: {
    session: 'helper-session-name',
    position: 'helper-position',
    size: 'helper-size',
  },
  fabColor: 'var(--color-accent)',
  fabColorHover: 'var(--color-accent-bright)',
  Icon: MessageCircle,
  iconSize: 13,
  title: 'Helper',
  subtitle: 'Knows your whole system · ask anything',
  chips: [
    { icon: '🐛', label: 'Bug', msg: 'I found a bug: ', tip: "Report something that's not working right" },
    { icon: '💡', label: 'Idea', msg: 'I have an idea: ', tip: 'Share a feature idea or suggestion' },
    { icon: '❓', label: 'How does this work?', msg: 'How do I ', tip: 'Ask anything about how the system works' },
    { icon: '👍', label: 'Loving it', msg: 'I love ', tip: "Share what's working well" },
  ],
  sessionCreator: api.createHelperSession,
  stackIndex: 0,
  ariaLabel: 'Open helper',
  fabTitle: 'Helper & Feedback — drag to move',
  closeTitle: 'Close — ends session, opens fresh next time',
  closeDialog: {
    title: 'Close "Helper"?',
    description: 'End this session. Next open spawns a fresh helper.',
  },
}

export function HelperWidget() {
  return <FloatingChatWidget config={HELPER_CONFIG} />
}

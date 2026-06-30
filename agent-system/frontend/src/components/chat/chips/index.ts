import remarkGfm from 'remark-gfm'
import { EntityChip } from './EntityChip'
import { SessionChip } from './SessionChip'
import { FileChipInline } from './FileChipInline'
import { FolderChipInline } from './FolderChipInline'
import { remarkChatRefs } from '@/lib/remark-chat-refs'

/**
 * Streamdown components map entry for inline chip rendering.
 * Custom mdast nodes from remarkChatRefs map to React chip components here.
 */
export const chatChipComponents = {
  'entity-chip': EntityChip as any,
  'session-chip': SessionChip as any,
  'file-chip-inline': FileChipInline as any,
  'folder-chip-inline': FolderChipInline as any,
}

/**
 * Passing `remarkPlugins` to <Streamdown/> REPLACES its default plugin list
 * (which includes remark-gfm). If we passed just [remarkChatRefs], tables,
 * strikethrough, and other GFM markdown stops being parsed. Prepend remark-gfm
 * here so GFM features keep working alongside our chip extension.
 */
export const chatChipRemarkPlugins = [remarkGfm, remarkChatRefs]

/**
 * Streamdown sanitizes unknown tags via rehype-sanitize unless they're in
 * allowedTags. Each entry maps tag → permitted attribute names.
 */
export const chatChipAllowedTags: Record<string, string[]> = {
  'entity-chip':       ['taskid', 'project', 'path', 'filename', 'source', 'data-chip'],
  'session-chip':      ['sessionname', 'role', 'data-chip'],
  'file-chip-inline':  ['path', 'ext', 'data-chip'],
  'folder-chip-inline':['path', 'data-chip'],
}

export { EntityChip, SessionChip, FileChipInline, FolderChipInline, remarkChatRefs }

import { useState, useEffect, useRef, useCallback } from 'react'
import { FileText, Folder, Upload, ChevronRight, Clock, ArrowLeft } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.tsx'
import {
  Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command.tsx'
import * as api from '@/lib/api.ts'
import { IconButton } from '@/components/primitives'

const RECENT_KEY = 'vault-recent-files'
const MAX_RECENT = 10

interface RecentFile {
  path: string
  name: string
  ts: number
}

function getRecent(): RecentFile[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch { return [] }
}

export function addToRecent(path: string, name: string) {
  try {
    const recent = getRecent().filter(r => r.path !== path)
    recent.unshift({ path, name, ts: Date.now() })
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch { /* ignore */ }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface SearchResult {
  name: string
  path: string
  size: number
  mtime: number
}

interface DirEntry {
  name: string
  type: 'file' | 'dir'
  size?: number
  count?: number
}

interface FileSearchPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (vaultPath: string, fileName: string) => void
  onUploadClick: () => void
  children: React.ReactNode
}

export function FileSearchPicker({ open, onOpenChange, onSelect, onUploadClick, children }: FileSearchPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [browsePath, setBrowsePath] = useState<string | null>(null)
  const [browseEntries, setBrowseEntries] = useState<DirEntry[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset state when popover opens/closes
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setBrowsePath(null)
      setBrowseEntries([])
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.searchVaultFiles(query.trim())
        setResults(data.results || [])
      } catch (err) {
        console.warn('Vault file search failed:', err)
        setResults([])
      }
      setSearching(false)
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Browse mode — load directory
  useEffect(() => {
    if (browsePath === null) return
    setBrowseLoading(true)
    api.fetchVaultDirectory(browsePath)
      .then(data => { setBrowseEntries(data.entries); setBrowseLoading(false) })
      .catch(() => { setBrowseEntries([]); setBrowseLoading(false) })
  }, [browsePath])

  const handleSelectFile = useCallback((path: string, name: string) => {
    addToRecent(path, name)
    onSelect(path, name)
  }, [onSelect])

  const handleBrowseFolder = useCallback((path: string) => {
    setBrowsePath(path)
    setQuery('')
  }, [])

  const handleBrowseBack = useCallback(() => {
    if (!browsePath) return
    const parent = browsePath.substring(0, browsePath.lastIndexOf('/'))
    if (!parent || parent === browsePath) {
      setBrowsePath(null)
    } else {
      setBrowsePath(parent)
    }
  }, [browsePath])

  const recent = getRecent()
  const isSearching = query.trim().length > 0
  const isBrowsing = browsePath !== null && !isSearching

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[320px] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={isBrowsing ? 'Filter...' : 'Search vault files...'}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[280px]">

            {/* Browse mode */}
            {isBrowsing && (
              <>
                <div className="flex items-center gap-1 px-3 py-1.5 type-micro text-muted-foreground border-b border-border">
                  <IconButton
                    variant="appShell"
                    size="file"
                    onClick={handleBrowseBack}
                    title="Back"
                  >
                    <ArrowLeft size={12} />
                  </IconButton>
                  <span className="truncate">{browsePath}</span>
                </div>
                <CommandGroup>
                  {browseLoading ? (
                    <div className="py-4 text-center type-micro text-muted-foreground">Loading...</div>
                  ) : browseEntries.length === 0 ? (
                    <div className="py-4 text-center type-micro text-muted-foreground">(empty)</div>
                  ) : browseEntries.filter(e => !query.trim() || e.name.toLowerCase().includes(query.trim().toLowerCase())).map(entry => (
                    <CommandItem
                      key={entry.name}
                      value={entry.name}
                      onSelect={() => {
                        const fullPath = `${browsePath}/${entry.name}`
                        if (entry.type === 'dir') {
                          handleBrowseFolder(fullPath)
                        } else {
                          handleSelectFile(fullPath, entry.name)
                        }
                      }}
                      className="flex items-center gap-2 py-1.5 cursor-pointer"
                    >
                      {entry.type === 'dir'
                        ? <Folder size={14} className="text-muted-foreground shrink-0" />
                        : <FileText size={14} className="text-muted-foreground shrink-0" />
                      }
                      <span className="type-label truncate flex-1">{entry.name}</span>
                      {entry.type === 'dir' && (
                        <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                      )}
                      {entry.type === 'file' && entry.size != null && (
                        <span className="type-micro text-muted-foreground shrink-0">{formatSize(entry.size)}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Search mode */}
            {isSearching && !isBrowsing && (
              <CommandGroup>
                {searching ? (
                  <div className="py-4 text-center type-micro text-muted-foreground">Searching...</div>
                ) : results.length === 0 ? (
                  <CommandEmpty>No files found.</CommandEmpty>
                ) : results.map(r => (
                  <CommandItem
                    key={r.path}
                    value={r.path}
                    onSelect={() => handleSelectFile(r.path, r.name)}
                    className="flex flex-col items-start gap-0 py-1.5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <FileText size={14} className="text-muted-foreground shrink-0" />
                      <span className="type-label truncate flex-1">{r.name}</span>
                      <span className="type-micro text-muted-foreground shrink-0">{formatSize(r.size)}</span>
                    </div>
                    <span className="type-micro text-muted-foreground truncate w-full pl-[22px]">
                      {r.path.substring(0, r.path.lastIndexOf('/'))}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Default mode — recent + browse roots */}
            {!isSearching && !isBrowsing && (
              <>
                {recent.length > 0 && (
                  <CommandGroup heading="Recent">
                    {recent.map(r => (
                      <CommandItem
                        key={r.path}
                        value={r.path}
                        onSelect={() => handleSelectFile(r.path, r.name)}
                        className="flex items-center gap-2 py-1.5 cursor-pointer"
                      >
                        <Clock size={14} className="text-muted-foreground shrink-0" />
                        <span className="type-label truncate flex-1">{r.name}</span>
                        <span className="type-micro text-muted-foreground truncate max-w-[120px]">
                          {r.path.substring(0, r.path.lastIndexOf('/'))}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandGroup heading="Browse">
                  <CommandItem
                    value="projects"
                    onSelect={() => handleBrowseFolder('projects')}
                    className="flex items-center gap-2 py-1.5 cursor-pointer"
                  >
                    <Folder size={14} className="text-muted-foreground shrink-0" />
                    <span className="type-label flex-1">projects/</span>
                    <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                  </CommandItem>
                  <CommandItem
                    value="State"
                    onSelect={() => handleBrowseFolder('State')}
                    className="flex items-center gap-2 py-1.5 cursor-pointer"
                  >
                    <Folder size={14} className="text-muted-foreground shrink-0" />
                    <span className="type-label flex-1">State/</span>
                    <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="upload"
                onSelect={onUploadClick}
                className="flex items-center gap-2 py-1.5 cursor-pointer"
              >
                <Upload size={14} className="text-muted-foreground shrink-0" />
                <span className="type-label">Upload from computer</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

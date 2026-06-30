/**
 * Minimal Dataview-compatible API for the dashboard.
 *
 * This is an original implementation that mimics the public `dv` API surface
 * used in DataviewJS blocks (dv.current(), dv.pages(), dv.paragraph(), etc.).
 * No code is copied from obsidian-dataview (MIT, Michael Brenan) — only the
 * public interface is re-implemented from scratch.
 *
 * Supports the subset of the API used in vault breadcrumb blocks:
 *   dv.current()            — current file's page object
 *   dv.pages(source?)       — DataArray of all indexed pages
 *   dv.paragraph(markdown)  — emit a paragraph of markdown
 *   dv.list(items)          — emit a bullet list
 *   dv.table(headers, rows) — emit a table
 *   DataArray#where(fn)     — filter
 *   DataArray#sort(fn)      — sort
 *   DataArray#first()       — first element or undefined
 *   DataArray#limit(n)      — take first n
 *   DataArray#map(fn)       — transform
 *   DataArray#forEach(fn)   — iterate
 *   DataArray#length        — count
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskFile {
  name: string   // stem without .md
  path: string   // vault-relative path
  link: string   // display name for [[link]] resolution
}

/** A page in the vault index — shape mirrors what the breadcrumb scripts expect. */
export interface VaultPage {
  /** Task id like "1.4.2" */
  id: string
  title: string
  status: string
  /** Parent task id like "1.4" */
  parent: string
  project_id: string
  outcome?: string
  desc?: string
  /** File metadata — mirrors dv's page.file */
  file: TaskFile
  /** Any extra frontmatter fields */
  [key: string]: unknown
}

/** Output nodes produced by dv.paragraph / dv.list / dv.table */
export type DvOutput =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: unknown[] }
  | { type: 'table'; headers: string[]; rows: unknown[][] }
  | { type: 'error'; message: string }

// ---------------------------------------------------------------------------
// DataArray — a chainable array wrapper
// ---------------------------------------------------------------------------

export class DataArray<T = VaultPage> {
  private _items: T[]

  constructor(items: T[]) {
    this._items = items
  }

  get length(): number {
    return this._items.length
  }

  where(predicate: (item: T) => boolean): DataArray<T> {
    return new DataArray(this._items.filter(predicate))
  }

  /** Alias for where() — used in some dataview patterns */
  filter(predicate: (item: T) => boolean): DataArray<T> {
    return this.where(predicate)
  }

  sort(compareFn?: (a: T, b: T) => number): DataArray<T> {
    return new DataArray([...this._items].sort(compareFn))
  }

  first(): T | undefined {
    return this._items[0]
  }

  last(): T | undefined {
    return this._items[this._items.length - 1]
  }

  limit(n: number): DataArray<T> {
    return new DataArray(this._items.slice(0, n))
  }

  map<U>(fn: (item: T, idx: number) => U): DataArray<U> {
    return new DataArray(this._items.map(fn))
  }

  flatMap<U>(fn: (item: T, idx: number) => U[]): DataArray<U> {
    return new DataArray(this._items.flatMap(fn))
  }

  forEach(fn: (item: T, idx: number) => void): void {
    this._items.forEach(fn)
  }

  toArray(): T[] {
    return [...this._items]
  }

  /** Support for-of iteration */
  [Symbol.iterator](): Iterator<T> {
    return this._items[Symbol.iterator]()
  }
}

// ---------------------------------------------------------------------------
// dv API factory
// ---------------------------------------------------------------------------

/**
 * Create a `dv` object bound to `currentPage` and `allPages`.
 * Returns the dv object and an `outputs` array that is filled as the script runs.
 */
export function createDvApi(
  currentPage: VaultPage,
  allPages: VaultPage[],
): { dv: Record<string, unknown>; outputs: DvOutput[] } {
  const outputs: DvOutput[] = []

  const dv = {
    /** The current file's page data (frontmatter + file metadata). */
    current(): VaultPage {
      return currentPage
    },

    /**
     * Returns all indexed pages.
     * The source argument is accepted for compatibility but ignored —
     * we return the full index and let callers filter with .where().
     */
    pages(_source?: string): DataArray<VaultPage> {
      return new DataArray(allPages)
    },

    /** Emit a paragraph of markdown text. */
    paragraph(text: unknown): void {
      outputs.push({ type: 'paragraph', text: String(text ?? '') })
    },

    /** Emit a bullet list. */
    list(items: unknown[]): void {
      outputs.push({ type: 'list', items: Array.isArray(items) ? items : [] })
    },

    /** Emit a table with headers and row data. */
    table(headers: string[], rows: unknown[][]): void {
      outputs.push({ type: 'table', headers, rows })
    },

    /** No-op header — dataview compatibility */
    header(_level: number, text: unknown): void {
      outputs.push({ type: 'paragraph', text: String(text ?? '') })
    },

    /** Span — treated as inline paragraph */
    span(text: unknown): void {
      outputs.push({ type: 'paragraph', text: String(text ?? '') })
    },

    /** DataArray constructor — occasionally scripts create one directly */
    array(items: unknown[]): DataArray<unknown> {
      return new DataArray(items)
    },

    /** Dataview utility — return page by path or link */
    page(pathOrLink: string): VaultPage | undefined {
      return allPages.find(p => p.file.path === pathOrLink || p.file.name === pathOrLink)
    },
  }

  return { dv, outputs }
}

// ---------------------------------------------------------------------------
// Output → markdown converter
// ---------------------------------------------------------------------------

/**
 * Convert DvOutput nodes to a single markdown string that can be
 * rendered with ReactMarkdown (including wikilinks).
 */
export function outputsToMarkdown(outputs: DvOutput[]): string {
  return outputs.map(node => {
    switch (node.type) {
      case 'paragraph':
        return node.text

      case 'list':
        return node.items.map(item => `- ${String(item)}`).join('\n')

      case 'table': {
        const header = `| ${node.headers.join(' | ')} |`
        const sep = `| ${node.headers.map(() => '---').join(' | ')} |`
        const rows = node.rows.map(
          row => `| ${row.map(cell => String(cell ?? '')).join(' | ')} |`
        )
        return [header, sep, ...rows].join('\n')
      }

      case 'error':
        return `> ⚠️ DataviewJS error: ${node.message}`

      default:
        return ''
    }
  }).join('\n\n')
}

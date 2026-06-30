/**
 * Minimal Dataview Query Language (DQL) executor.
 *
 * Handles the TABLE WITHOUT ID pattern used in vault task files:
 *   TABLE WITHOUT ID col1 AS Header1, col2 AS Header2, ...
 *   FROM "path"
 *   WHERE field = "value" AND field = this.field
 *   [SORT field ASC|DESC]
 *   [GROUP BY true]
 *
 * Column expressions support: choice(), link(), filter(), length(), string
 * concatenation, and bare field access (via `with(page)`).
 *
 * Security: executes user-authored vault JS. Same trust model as DataviewBlock.
 */

import type { VaultPage } from '@/lib/dataview.ts'

export interface DqlResult {
  markdown: string
  error: string | null
}

// ---------------------------------------------------------------------------
// Column parser — splits top-level commas only (respects nested parentheses)
// ---------------------------------------------------------------------------

interface Column {
  expr: string
  header: string
}

function parseColumns(section: string): Column[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  let inStr = false
  let strChar = ''

  for (let i = 0; i < section.length; i++) {
    const c = section[i]
    if (inStr) {
      if (c === strChar && section[i - 1] !== '\\') inStr = false
    } else if (c === '"' || c === "'") {
      inStr = true; strChar = c
    } else if (c === '(') {
      depth++
    } else if (c === ')') {
      depth--
    } else if (c === ',' && depth === 0) {
      parts.push(section.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(section.slice(start).trim())

  return parts.filter(Boolean).map(col => {
    // Match "expr AS Header" or "expr AS "Header""
    const m = col.match(/^([\s\S]+?)\s+AS\s+"?([^"]*)"?\s*$/i)
    if (m) return { expr: m[1].trim(), header: m[2].trim() }
    return { expr: col.trim(), header: col.trim() }
  })
}

// ---------------------------------------------------------------------------
// DQL expression → JS converter
// ---------------------------------------------------------------------------

function dqlToJs(expr: string): string {
  return expr
    // DQL equality: bare `=` (not ==, !=, <=, >=, =>) → ===
    .replace(/([^=!<>])=([^=>])/g, '$1===$2')
    // this.field → current["field"]
    .replace(/\bthis\.(\w+)\b/g, (_, f) => `current[${JSON.stringify(f)}]`)
    // DQL AND/OR → JS
    .replace(/\bAND\b/g, '&&')
    .replace(/\bOR\b/g, '||')
}

// ---------------------------------------------------------------------------
// Expression evaluator — runs a single DQL column expression
// ---------------------------------------------------------------------------

function evalExpr(
  expr: string,
  page: VaultPage | null,
  rows: VaultPage[],
  current: VaultPage,
): unknown {
  const js = dqlToJs(expr)

  // Helper functions injected into scope
  type ChoiceFn = (cond: unknown, a: unknown, b: unknown) => unknown
  type LinkFn = (target: unknown, text?: unknown) => string
  type LengthFn = (arr: unknown) => number
  type FilterFn = (arr: VaultPage[], fn: (p: VaultPage) => boolean) => VaultPage[]

  const choiceFn: ChoiceFn = (cond, a, b) => (cond ? a : b)
  const linkFn: LinkFn = (target, text) =>
    text != null ? `[[${target}|${text}]]` : `[[${target}]]`
  const lengthFn: LengthFn = (arr) =>
    Array.isArray(arr) ? arr.length : (arr as { length?: number })?.length ?? 0
  const filterFn: FilterFn = (arr, fn) =>
    Array.isArray(arr) ? arr.filter(fn) : []

  try {
    // Use `with(page)` for field access — valid in non-strict Function bodies
    // eslint-disable-next-line no-new-func
    const fn = Function(
      'page', 'rows', 'current', 'choice', 'link', 'length', 'filter',
      `with (page || {}) { return (${js}) }`,
    ) as (
      p: VaultPage | null,
      r: VaultPage[],
      c: VaultPage,
      ch: ChoiceFn,
      lk: LinkFn,
      ln: LengthFn,
      fl: FilterFn,
    ) => unknown

    return fn(page, rows, current, choiceFn, linkFn, lengthFn, filterFn)
  } catch (err) {
    return `⚠️ expr error: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ---------------------------------------------------------------------------
// WHERE filter builder
// ---------------------------------------------------------------------------

function buildWhereFilter(
  whereClause: string,
  current: VaultPage,
): (p: VaultPage) => boolean {
  const js = dqlToJs(whereClause)
  try {
    // eslint-disable-next-line no-new-func
    const fn = Function(
      'page', 'current',
      `with (page) { return Boolean(${js}) }`,
    ) as (p: VaultPage, c: VaultPage) => boolean
    return (p: VaultPage) => { try { return fn(p, current) } catch { return false } }
  } catch {
    return () => true
  }
}

// ---------------------------------------------------------------------------
// Main DQL executor
// ---------------------------------------------------------------------------

export function executeDql(
  query: string,
  currentPage: VaultPage,
  allPages: VaultPage[],
): DqlResult {
  if (!/^\s*TABLE/i.test(query)) {
    return { markdown: '', error: 'Only TABLE queries are supported' }
  }

  // Extract structural parts
  const fromMatch = query.match(/FROM\s+"([^"]+)"/i)
  const whereMatch = query.match(/WHERE\s+([\s\S]+?)(?:\n(?:SORT|GROUP\s+BY|$))/i)
    ?? query.match(/WHERE\s+([\s\S]+?)$/i)
  const sortMatch = query.match(/SORT\s+(\w+)\s+(ASC|DESC)/i)
  const groupByTrue = /GROUP\s+BY\s+true/i.test(query)

  // Column section: between TABLE [WITHOUT ID] and FROM
  const colsSection = query
    .replace(/^\s*TABLE\s+(?:WITHOUT\s+ID\s+)?/i, '')
    .split(/\s+FROM\s+/i)[0]
    .trim()

  const columns = parseColumns(colsSection)
  if (columns.length === 0) {
    return { markdown: '', error: 'No columns found in query' }
  }

  // 1. Filter by FROM path prefix
  let pages = fromMatch
    ? allPages.filter(p => p.file.path.startsWith(fromMatch[1]))
    : allPages

  // 2. Apply WHERE
  if (whereMatch) {
    const filterFn = buildWhereFilter(whereMatch[1].trim(), currentPage)
    pages = pages.filter(filterFn)
  }

  // 3. Sort
  if (sortMatch) {
    const field = sortMatch[1]
    const asc = sortMatch[2].toUpperCase() === 'ASC'
    pages = [...pages].sort((a, b) => {
      const va = (a as Record<string, unknown>)[field] ?? 0
      const vb = (b as Record<string, unknown>)[field] ?? 0
      if (va === vb) return 0
      return (asc ? va > vb : va < vb) ? 1 : -1
    })
  }

  // 4. Render table
  const headers = columns.map(c => c.header || ' ')
  const header = `| ${headers.join(' | ')} |`
  const sep = `| ${headers.map(() => '---').join(' | ')} |`

  if (groupByTrue) {
    // One aggregate row — `rows` in expressions = all matched pages
    const row = columns.map(col =>
      String(evalExpr(col.expr, null, pages, currentPage) ?? ''),
    )
    if (pages.length === 0) return { markdown: '', error: null }
    return { markdown: [header, sep, `| ${row.join(' | ')} |`].join('\n'), error: null }
  }

  if (pages.length === 0) return { markdown: '', error: null }

  const rows = pages.map(page => {
    const cells = columns.map(col =>
      String(evalExpr(col.expr, page, pages, currentPage) ?? ''),
    )
    return `| ${cells.join(' | ')} |`
  })

  return { markdown: [header, sep, ...rows].join('\n'), error: null }
}

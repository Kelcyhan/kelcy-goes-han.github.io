declare module 'bibtex-parse' {
  interface BibEntry {
    key: string
    type: string
    [field: string]: string | number | undefined
  }
  const bibtexParse: {
    entries(input: string): BibEntry[]
    parse(input: string, options?: Record<string, unknown>): unknown
  }
  export default bibtexParse
}

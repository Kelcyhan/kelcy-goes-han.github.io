import { useMemo } from 'react'
import Papa from 'papaparse'
import { Text } from '@/components/primitives'

interface CsvViewerProps {
  content: string
}

export default function CsvViewer({ content }: CsvViewerProps) {
  const { headers, rows } = useMemo(() => {
    const result = Papa.parse<string[]>(content, { skipEmptyLines: true })
    if (!result.data.length) return { headers: [], rows: [] }
    return {
      headers: result.data[0],
      rows: result.data.slice(1),
    }
  }, [content])

  if (!headers.length) {
    return <Text as="div" variant="bodyMd" tone="muted" className="p-4">(Empty CSV)</Text>
  }

  return (
    <div className="overflow-auto max-h-[70vh] rounded-md border border-border">
      <table className="border-collapse w-full min-w-max type-body-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="border border-border bg-[var(--bg-raised)] px-2.5 py-1.5 text-left type-semibold whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-[var(--bg-card-hover)] transition-colors">
              {headers.map((_, ci) => (
                <td
                  key={ci}
                  className="border border-border px-2.5 py-1 whitespace-nowrap"
                >
                  {row[ci] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

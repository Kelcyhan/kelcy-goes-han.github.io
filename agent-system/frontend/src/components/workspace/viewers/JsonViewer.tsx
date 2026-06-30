import { useMemo } from 'react'
import { JsonTree } from './JsonTree.tsx'

interface JsonViewerProps {
  content: string
}

export default function JsonViewer({ content }: JsonViewerProps) {
  const data = useMemo(() => {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  }, [content])

  if (data === null) {
    return (
      <pre className="type-label whitespace-pre-wrap break-words m-0 font-mono p-4">
        {content}
      </pre>
    )
  }

  return <JsonTree data={data} />
}

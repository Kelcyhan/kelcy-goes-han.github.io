import { useMemo } from 'react'
import jsYaml from 'js-yaml'
import { JsonTree } from './JsonTree.tsx'

interface YamlViewerProps {
  content: string
}

export default function YamlViewer({ content }: YamlViewerProps) {
  const data = useMemo(() => {
    try {
      return jsYaml.load(content)
    } catch {
      return null
    }
  }, [content])

  if (data === null || typeof data !== 'object') {
    return (
      <pre className="type-label whitespace-pre-wrap break-words m-0 font-mono p-4">
        {content}
      </pre>
    )
  }

  return <JsonTree data={data} />
}

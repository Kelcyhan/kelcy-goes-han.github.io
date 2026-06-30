import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.label ?? 'unknown'}]:`, error, info)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="p-6 text-muted-foreground text-center">
          <p className="type-body-sm">Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}.</p>
          <p className="type-micro mt-2 opacity-70">{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

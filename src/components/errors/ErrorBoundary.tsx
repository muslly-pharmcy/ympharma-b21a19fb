import { Component, type ErrorInfo, type ReactNode } from 'react'
import { classifyError, type ClassifiedError } from '@/lib/errors/classify'
import { newCorrelationId } from '@/lib/errors/correlation'
import { reportError } from '@/lib/errors/logger'
import { ErrorScreen } from './ErrorScreen'

interface Props {
  boundary: string
  children: ReactNode
  variant?: 'page' | 'inline'
  fallback?: (ctx: {
    classified: ClassifiedError
    correlationId: string
    retry: () => void
    retryCount: number
    retrying: boolean
  }) => ReactNode
  onReset?: () => void
}

interface State {
  classified: ClassifiedError | null
  correlationId: string
  retryCount: number
  retrying: boolean
  key: number
}

// Exponential backoff (ms) for auto-retry-able errors.
const BACKOFF_MS = [400, 1200, 3000]
const MAX_RETRIES = BACKOFF_MS.length

export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = {
    classified: null,
    correlationId: '',
    retryCount: 0,
    retrying: false,
    key: 0,
  }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return {
      classified: classifyError(error),
      correlationId: newCorrelationId(),
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const classified = classifyError(error)
    const correlationId = this.state.correlationId || newCorrelationId()
    if (!this.state.correlationId) this.setState({ correlationId })
    reportError({
      correlationId,
      classified,
      boundary: this.props.boundary,
      extra: { componentStack: info.componentStack },
    })
  }

  private handleRetry = (): void => {
    const { classified, retryCount } = this.state
    if (!classified) return

    if (retryCount >= MAX_RETRIES) {
      this.reset()
      return
    }

    const delay = BACKOFF_MS[Math.min(retryCount, BACKOFF_MS.length - 1)]
    this.setState({ retrying: true })
    window.setTimeout(() => {
      this.setState((s) => ({
        classified: null,
        retrying: false,
        retryCount: s.retryCount + 1,
        key: s.key + 1,
      }))
      this.props.onReset?.()
    }, delay)
  }

  private reset = (): void => {
    this.setState((s) => ({
      classified: null,
      retrying: false,
      retryCount: 0,
      key: s.key + 1,
    }))
    this.props.onReset?.()
  }

  render(): ReactNode {
    const { classified, correlationId, retrying, retryCount, key } = this.state
    if (!classified) {
      // key bump forces subtree remount after recovery.
      return <div key={key}>{this.props.children}</div>
    }

    if (this.props.fallback) {
      return this.props.fallback({
        classified,
        correlationId,
        retry: this.handleRetry,
        retryCount,
        retrying,
      })
    }

    return (
      <ErrorScreen
        classified={classified}
        correlationId={correlationId}
        boundary={this.props.boundary}
        variant={this.props.variant ?? 'inline'}
        onRetry={this.handleRetry}
        retrying={retrying}
        retryCount={retryCount}
      />
    )
  }
}

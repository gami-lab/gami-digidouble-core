import { Component } from 'react'
import type { ErrorInfo, JSX, ReactNode } from 'react'

type ErrorBoundaryState = { message: string | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { message: error instanceof Error ? error.message : 'Unexpected error' }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[console] Render failed:', error, info.componentStack)
  }

  override render(): JSX.Element {
    if (this.state.message === null) return <>{this.props.children}</>
    return (
      <main className="page">
        <p className="error-text">The console crashed: {this.state.message}</p>
        <button
          type="button"
          onClick={() => {
            window.location.reload()
          }}
        >
          Reload
        </button>
      </main>
    )
  }
}

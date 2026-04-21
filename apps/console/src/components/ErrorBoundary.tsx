import type { ErrorInfo, JSX, ReactNode } from 'react'
import { Component } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  message: string
}

const fallbackContainerStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '16px',
  border: '1px solid #b91c1c',
  borderRadius: '8px',
  backgroundColor: '#fee2e2',
  color: '#7f1d1d',
}

const fallbackButtonStyle = {
  marginTop: '12px',
  padding: '8px 12px',
  border: '1px solid #7f1d1d',
  borderRadius: '8px',
  backgroundColor: '#7f1d1d',
  color: '#ffffff',
  cursor: 'pointer',
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled UI error', error, errorInfo)
  }

  public render(): JSX.Element {
    if (this.state.hasError) {
      return (
        <section role="alert" style={fallbackContainerStyle}>
          <strong>Unhandled UI error:</strong> {this.state.message}
          <div>
            <button
              type="button"
              style={fallbackButtonStyle}
              onClick={() => {
                window.location.reload()
              }}
            >
              Reload
            </button>
          </div>
        </section>
      )
    }

    return <>{this.props.children}</>
  }
}

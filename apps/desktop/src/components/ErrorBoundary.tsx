import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="tray-panel flex flex-col items-center justify-center p-6 text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            className="mb-4"
          >
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="var(--color-danger)"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M24 14v12M24 30v4"
              stroke="var(--color-danger)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg text-sm font-medium
              bg-[var(--color-brand)] text-[var(--color-bg)]
              hover:bg-[var(--color-brand-dark)]
              transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

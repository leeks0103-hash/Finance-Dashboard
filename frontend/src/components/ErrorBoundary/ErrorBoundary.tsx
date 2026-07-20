import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ErrorFallback } from '@/components/ui';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <ErrorFallback
          message={this.state.error?.message}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

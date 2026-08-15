import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message ?? 'Error desconocido' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="bg-ruins flex min-h-screen items-center justify-center p-8">
            <div className="panel-ruin max-w-md p-8 text-center shadow-deep">
              <div className="mb-4 text-5xl">⚔️</div>
              <h2 className="title-carved text-lg">Las ruinas se derrumbaron</h2>
              <p className="flavor-brutal mt-2 text-sm">Algo quebró el campo de batalla</p>
              <p className="body-parchment mt-2 text-xs text-ink/60">Recarga para continuar la odisea</p>
              {import.meta.env.DEV && this.state.errorMessage && (
                <p className="body-parchment mt-3 break-all text-left text-[10px] text-ink/50">
                  {this.state.errorMessage}
                </p>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button onClick={this.handleReset} className="btn-war">
                  Reintentar
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-war btn-war-danger"
                >
                  Resurgir
                </button>
              </div>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

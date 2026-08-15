import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
}

/** Captura errores de overlays/FX sin tumbar toda la app. */
export class SilentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`SilentErrorBoundary${this.props.label ? ` (${this.props.label})` : ''}:`, error, info);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

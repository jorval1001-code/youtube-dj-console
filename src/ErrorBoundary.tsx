import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, an uncaught render error unmounts the whole tree and the dark app background
// (#09090b) is all that's left on screen — indistinguishable from a frozen/black app. This
// surfaces the actual error instead, and lets the user recover without force-closing the app.
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-6 gap-4 text-center font-sans">
          <span className="text-red-400 font-mono text-xs tracking-widest uppercase font-bold">
            Error inesperado
          </span>
          <p className="text-sm text-zinc-400 max-w-md font-mono break-words">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-mono border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-900 uppercase tracking-wider"
          >
            Recargar la app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

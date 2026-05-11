
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  // Explicitly declare props to satisfy TypeScript if base class inference fails
  declare props: Readonly<Props>;

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-500 animate-pulse">
             <i className="fas fa-exclamation-triangle text-4xl"></i>
          </div>
          <h1 className="text-3xl font-black text-foreground mb-2 tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground mb-8 max-w-md text-sm leading-relaxed">
            We encountered an unexpected error. Our engineering team has been notified. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-[#E86C44] text-white rounded-xl font-black text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-lg active:scale-95"
          >
            <i className="fas fa-redo mr-2"></i> Reload Application
          </button>
          {import.meta.env?.DEV && (
              <div className="mt-10 p-4 bg-muted/50 rounded-xl border border-border text-left w-full max-w-2xl overflow-auto max-h-64">
                  <p className="text-xs font-bold text-red-500 mb-2">ERROR DETAILS (DEV ONLY):</p>
                  <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                      {this.state.error?.toString()}
                  </pre>
              </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center dark:bg-canvas-dark">
        <h1 className="font-display text-2xl font-bold">Something broke</h1>
        <p className="max-w-sm text-sm text-quiet dark:text-quiet-dark">
          The page hit an unexpected error. Reload to pick up where you left off
          — chat and files on the server are still there.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-medium text-white"
        >
          Reload LocalShare
        </button>
      </div>
    );
  }
}

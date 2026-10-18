import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface State {
  error: Error | null;
  componentStack: string;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? '' });
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="surface w-full max-w-lg p-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertCircle className="size-5" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-ink-950">页面渲染失败</h1>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            当前页面遇到未处理的错误。你的会话和已提交内容不受影响，可以重新加载后再试。
          </p>
          <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-paper/70 px-3 py-2 text-left text-[10px] leading-relaxed text-rose-700">
            {this.state.error.message}
            {import.meta.env.DEV ? this.state.error.stack ?? '' : ''}
            {import.meta.env.DEV ? this.state.componentStack : ''}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary mt-4 h-10 px-4 text-xs"
          >
            <RefreshCw className="size-3.5" />
            重新加载
          </button>
        </div>
      </div>
    );
  }
}

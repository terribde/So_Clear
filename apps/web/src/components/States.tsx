import type { ReactNode } from 'react';
import { AlertCircle, LoaderCircle, SearchX } from 'lucide-react';

export function LoadingBlock({ className = 'h-24' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-line/55 ${className}`} />;
}

export function TeacherCardSkeleton() {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-11 animate-pulse rounded-2xl bg-line/70" />
          <div className="space-y-2">
            <div className="h-3.5 w-24 animate-pulse rounded bg-line/80" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-line/60" />
          </div>
        </div>
        <div className="h-9 w-16 animate-pulse rounded bg-line/60" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-20 animate-pulse rounded-lg bg-line/60" />
        <div className="h-6 w-24 animate-pulse rounded-lg bg-line/50" />
      </div>
      <div className="mt-4 h-8 animate-pulse rounded-lg bg-line/40" />
    </div>
  );
}

export function TeacherGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <TeacherCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="h-4 w-24 animate-pulse rounded bg-line/60" />
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="surface p-6">
            <div className="flex items-center gap-4">
              <div className="size-16 animate-pulse rounded-3xl bg-line/70" />
              <div className="space-y-3">
                <div className="h-5 w-40 animate-pulse rounded bg-line/80" />
                <div className="h-3 w-56 animate-pulse rounded bg-line/60" />
              </div>
            </div>
            <div className="mt-6 h-24 animate-pulse rounded-2xl bg-line/45" />
          </div>
          <div className="surface h-72 animate-pulse" />
        </div>
        <div className="space-y-5">
          <div className="surface h-48 animate-pulse" />
          <div className="surface h-64 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-jade-50 text-jade-600">
        {icon ?? <SearchX className="size-5" />}
      </span>
      <h3 className="mt-4 text-sm font-semibold text-ink-900">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <AlertCircle className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink-900">加载没有完成</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-500">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary mt-4 px-4 py-2 text-xs">
          <LoaderCircle className="size-3.5" />
          重新加载
        </button>
      ) : null}
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-3.5 py-2.5 text-xs text-rose-700">
      <span className="flex items-center gap-2">
        <AlertCircle className="size-4 shrink-0" />
        {message}
      </span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline-offset-2 hover:underline">
          重试
        </button>
      ) : null}
    </div>
  );
}

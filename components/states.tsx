import { TriangleAlert } from 'lucide-react';
import { btn } from '@/components/ui';

/** Shared loading skeleton: keeps the page shell steady while data loads. */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="mb-7 border-b border-line pb-5"><div className="h-7 w-48 animate-pulse rounded bg-raised" /><div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-raised/70" /></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-surface" />)}</div>
      <div className="mt-4 h-56 animate-pulse rounded-card border border-line bg-surface" />
    </div>
  );
}

export function ErrorState({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-20 text-center">
      <TriangleAlert size={26} className="mx-auto mb-4 text-warn" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-muted">Nothing was lost. Try again, and if it keeps happening tell your administrator.</p>
      <button onClick={reset} className={`${btn} mt-6`}>Try again</button>
    </div>
  );
}

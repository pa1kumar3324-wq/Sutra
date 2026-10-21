import Link from 'next/link';
import clsx from 'clsx';
import { CheckCircle2, CircleAlert, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

/* ---------- Class strings (kept as exports so every page uses the same controls) ---------- */
const base = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45';
/** Primary action. Gold-light fill is reserved for the one main action on a screen. */
export const btn = `${base} bg-gold-light text-[#171611] hover:bg-gold`;
/** Secondary action. */
export const btn2 = `${base} border border-line-strong bg-transparent text-ink hover:border-gold/60 hover:bg-raised`;
export const btnDanger = `${base} border border-bad/40 bg-transparent text-bad hover:bg-bad-soft`;
export const input = 'min-h-[44px] w-full rounded-lg border border-line-strong bg-inset px-3 py-2 text-base text-ink transition-colors duration-150 hover:border-[#57534a] disabled:opacity-50';
export const link = 'text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors hover:decoration-gold';

/* ---------- Feedback ---------- */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  const Icon = error ? CircleAlert : CheckCircle2;
  return (
    <div role={error ? 'alert' : 'status'} className={clsx('mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm animate-rise', error ? 'border-bad/40 bg-bad-soft text-bad' : 'border-ok/40 bg-ok-soft text-ok')}>
      <Icon size={18} className="mt-px shrink-0" aria-hidden />
      <span>{error ?? ok}</span>
    </div>
  );
}

/* ---------- Layout ---------- */
export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] sm:text-[30px]">{title}</h1>
        {sub && <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('panel p-4 sm:p-5', className)}>
      {title && <h2 className="mb-3 text-[15px] font-semibold tracking-tight">{title}</h2>}
      {children}
    </section>
  );
}
/** A heading that sits between blocks on a page (not inside a card). */
export function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-3 mt-9 first:mt-0">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </div>
  );
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface/60 px-4 py-10 text-center">
      <Inbox size={22} className="mx-auto mb-3 text-gold/70" aria-hidden />
      <p className="font-semibold">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Stat({ label, value, href, note }: { label: string; value: ReactNode; href?: string; note?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="tnum mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em]">{value}</p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </>
  );
  const cls = 'panel block p-4 transition-colors duration-150';
  return href ? <Link href={href} className={clsx(cls, 'hover:border-gold/50')}>{body}</Link> : <div className={cls}>{body}</div>;
}

/* ---------- Forms ---------- */
export function Field({ label, name, hint, children, required }: { label: string; name: string; hint?: string; children?: ReactNode; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">{label}{required ? '' : <span className="font-normal text-muted"> (optional)</span>}</label>
      {children ?? <input id={name} name={name} required={required} className={input} />}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
export function Select({ name, children, defaultValue, required }: { name: string; children: ReactNode; defaultValue?: string; required?: boolean }) {
  return <select id={name} name={name} defaultValue={defaultValue} required={required} className={clsx(input, 'pr-8')}>{children}</select>;
}

/* ---------- Data display ---------- */
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'brand';
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const t = {
    neutral: 'border-line-strong bg-raised text-muted', ok: 'border-ok/30 bg-ok-soft text-ok', warn: 'border-warn/30 bg-warn-soft text-warn',
    bad: 'border-bad/30 bg-bad-soft text-bad', brand: 'border-gold/30 bg-brand-soft text-gold-light',
  }[tone];
  return <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', t)}>{children}</span>;
}
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line-strong bg-raised/60 text-muted"><tr>{head.map((h, i) => <th key={h + i} scope="col" className="px-4 py-2.5 text-xs font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line [&>tr]:transition-colors [&>tr:hover]:bg-raised/50">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children: ReactNode; className?: string }) => <td className={clsx('px-4 py-3 align-top', className)}>{children}</td>;
export function Pager({ base, page, pageSize, total }: { base: string; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => `${base}${base.includes('?') ? '&' : '?'}page=${p}`;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span className="tnum text-muted">{total} total · page {page} of {pages}</span>
      <span className="flex gap-2">
        {page > 1 && <Link className={btn2} href={href(page - 1)}>Previous</Link>}
        {page < pages && <Link className={btn2} href={href(page + 1)}>Next</Link>}
      </span>
    </nav>
  );
}
/** Thin progress bar with an accessible value. Pass real counts only. */
export function Progress({ value, max, label, tone = 'gold' }: { value: number; max: number; label: string; tone?: 'gold' | 'ok' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
      <div className={clsx('h-full rounded-full transition-[width] duration-300', tone === 'ok' ? 'bg-ok' : 'bg-gold')} style={{ width: `${pct}%` }} />
    </div>
  );
}
export const statusTone = (s: string): 'ok' | 'warn' | 'bad' | 'neutral' =>
  ['active', 'completed'].includes(s) ? 'ok' : ['in_progress', 'invited', 'draft', 'planned'].includes(s) ? 'warn' : ['deactivated', 'withdrawn'].includes(s) ? 'bad' : 'neutral';

import type { ReactNode } from 'react';
import { Logo, Mark } from '@/components/brand/Logo';

/**
 * Shared frame for sign-in, reset and invitation screens.
 * Desktop: brand panel (the one expressive moment) beside the form. Mobile: form only, with the logo on top.
 */
export function AuthShell({ title, sub, children, footer }: { title: string; sub?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section aria-hidden className="relative hidden items-center justify-center overflow-hidden border-r border-line lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_30%,#c7a76b14,transparent_70%)]" />
        <div className="absolute h-[520px] w-[520px] rounded-full border border-gold/15 shadow-[0_0_0_46px_#c7a76b08,0_0_0_92px_#c7a76b05]" />
        <div className="relative flex aspect-[1.17/1] w-[min(78%,440px)] flex-col items-center justify-center overflow-hidden border border-white/15 bg-gradient-to-br from-[#20201d] via-[#11110f] to-[#181714] shadow-[0_40px_100px_#000000a0] animate-rise">
          <div className="absolute -inset-y-10 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-sheen" />
          <Mark className="mb-6 w-14" />
          <p className="text-5xl font-semibold tracking-[0.16em]">Sutra</p>
          <p className="mt-4 font-mono text-[11px] tracking-[0.2em] text-muted">by Emporum</p>
        </div>
      </section>
      <section className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo size="lg" /></div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
          {sub && <p className="mb-7 mt-2 text-sm text-muted">{sub}</p>}
          {!sub && <div className="mb-7" />}
          {children}
          {footer && <p className="mt-6 text-center text-sm">{footer}</p>}
        </div>
      </section>
    </main>
  );
}

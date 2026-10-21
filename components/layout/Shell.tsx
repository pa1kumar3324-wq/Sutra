import { LogOut } from 'lucide-react';
import { logout } from '@/lib/actions/auth';
import type { Ctx } from '@/lib/auth/session';
import { Logo } from '@/components/brand/Logo';
import { MobileNav } from './MobileNav';
import { NavLinks } from './NavLinks';

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Administrator', teacher: 'Teacher', coordinator: 'Coordinator', auditor: 'Auditor' };

export function Shell({ ctx, children }: { ctx: Ctx; children: React.ReactNode }) {
  const initials = ctx.displayName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const who = (
    <div className="border-t border-line pt-4">
      <div className="flex items-center gap-3 px-1">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-brand-soft text-xs font-semibold text-gold-light">{initials}</span>
        <div className="min-w-0"><p className="truncate text-sm font-medium">{ctx.displayName}</p><p className="text-xs text-muted">{ROLE_LABEL[ctx.role] ?? ctx.role}</p></div>
      </div>
      <form action={logout}><button className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-ink"><LogOut size={16} aria-hidden /> Sign out</button></form>
    </div>
  );
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-line bg-[#0d0d0c] px-4 pb-5 pt-8 md:flex">
        <div>
          <div className="mb-8 px-3"><Logo /></div>
          <p className="mb-5 truncate px-3 text-xs text-muted">{ctx.orgName}</p>
          <NavLinks role={ctx.role} />
        </div>
        {who}
      </aside>
      <div className="min-w-0 flex-1">
        <MobileNav role={ctx.role} orgName={ctx.orgName}>{who}</MobileNav>
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-8 sm:pt-10">{children}</main>
      </div>
    </div>
  );
}

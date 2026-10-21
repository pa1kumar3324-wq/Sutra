'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { NavLinks } from './NavLinks';

/** Mobile top bar + slide-down menu. Closes on navigation and on Escape. */
export function MobileNav({ role, orgName, children }: { role: string; orgName: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    // Escape closes the menu and puts focus back on the toggle: the focused link is unmounted with the menu,
    // so without this a keyboard user would be dropped at the top of the page.
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open]);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-xl md:hidden">
      <div className="flex h-[60px] items-center justify-between px-4">
        <Logo />
        <button ref={toggle} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-line-strong text-ink hover:bg-raised">
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="max-h-[calc(100dvh-60px)] animate-fade overflow-y-auto border-t border-line bg-paper px-3 pb-4 pt-3">
          <p className="mb-3 truncate px-3 text-xs text-muted">{orgName}</p>
          <NavLinks role={role} />
          <div className="mt-4">{children}</div>
        </div>
      )}
    </header>
  );
}

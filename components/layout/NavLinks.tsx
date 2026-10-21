'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { BookOpen, CalendarDays, ClipboardList, FileBarChart, GraduationCap, Layers, LayoutDashboard, ListChecks, School, Settings, ShieldCheck, Users } from 'lucide-react';

type Item = readonly [href: string, label: string, Icon: typeof School];
type Group = { label?: string; items: readonly Item[] };

const ADMIN: Group[] = [
  { items: [['/admin/dashboard', 'Dashboard', LayoutDashboard]] },
  { label: 'People', items: [['/admin/students', 'Students', GraduationCap], ['/admin/teachers', 'Teachers', Users], ['/admin/assignments', 'Assignments', Layers]] },
  { label: 'Teaching', items: [['/admin/classes', 'Classes', School], ['/admin/subjects', 'Subjects', BookOpen], ['/admin/topics', 'Topics', ListChecks], ['/admin/sessions', 'Sessions', ClipboardList]] },
  { label: 'Insight', items: [['/admin/reports', 'Reports', FileBarChart]] },
  { label: 'Trust', items: [['/admin/academic-years', 'Academic years', CalendarDays], ['/admin/settings', 'Settings', Settings], ['/admin/audit-logs', 'Audit log', ShieldCheck]] },
];
const TEACHER: Group[] = [
  { items: [['/teacher/dashboard', 'Today', LayoutDashboard], ['/teacher/classes', 'My classes', School], ['/teacher/reports', 'Reports', FileBarChart]] },
];

export function NavLinks({ role }: { role: string }) {
  const path = usePathname();
  const groups = role === 'teacher' ? TEACHER : ADMIN;
  return (
    <nav aria-label="Main" className="space-y-5">
      {groups.map((g, i) => (
        <div key={i}>
          {g.label && <p className="mb-1.5 px-3 text-xs font-medium text-[#7c786d]">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map(([href, label, Icon]) => {
              const active = path === href || path.startsWith(href + '/');
              return (
                <li key={href}>
                  <Link href={href} aria-current={active ? 'page' : undefined}
                    className={clsx('group relative flex min-h-[42px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
                      active ? 'bg-gradient-to-r from-gold/[0.13] to-transparent text-gold-light' : 'text-[#bdb8ad] hover:bg-raised hover:text-ink')}>
                    <span aria-hidden className={clsx('absolute inset-y-2 left-0 w-[2px] rounded-full bg-gold transition-opacity', active ? 'opacity-100' : 'opacity-0')} />
                    <Icon size={17} aria-hidden className={active ? 'text-gold' : 'text-muted group-hover:text-ink'} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

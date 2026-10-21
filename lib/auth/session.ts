import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Role = 'owner' | 'admin' | 'teacher' | 'coordinator' | 'auditor';
export type Ctx = {
  supabase: ReturnType<typeof createClient>;
  userId: string; email: string; displayName: string;
  orgId: string; orgName: string; timezone: string; role: Role;
};

/**
 * Resolves the caller's organization ONLY from a validated, active membership row (read through RLS).
 * A client-supplied organization id is never trusted; an `org_id` cookie is only a *preference*
 * and is honoured only if it matches one of the caller's own active memberships.
 */
export const getContext = cache(async (): Promise<Ctx | null> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('organization_memberships')
    .select('organization_id, role, organizations(name, timezone)')
    .eq('user_id', user.id).eq('status', 'active');
  const ms = (data ?? []) as unknown as { organization_id: string; role: Role; organizations: { name: string; timezone: string } | null }[];
  if (ms.length === 0) return null;
  const pref = cookies().get('org_id')?.value;
  const m = ms.find((x) => x.organization_id === pref) ?? ms[0];
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  return {
    supabase, userId: user.id, email: user.email ?? '', displayName: profile?.display_name || user.email || '',
    orgId: m.organization_id, orgName: m.organizations?.name ?? '', timezone: m.organizations?.timezone ?? 'UTC', role: m.role,
  };
});

export const isAdminRole = (r: Role) => r === 'owner' || r === 'admin';

export async function requireContext(): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx) redirect('/login?error=' + encodeURIComponent('Your session has ended or your access was removed. Sign in again.'));
  return ctx;
}
export async function requireAdmin(): Promise<Ctx> {
  const ctx = await requireContext();
  if (!isAdminRole(ctx.role)) redirect('/forbidden');
  return ctx;
}
export async function requireTeacher(): Promise<Ctx> {
  const ctx = await requireContext();
  if (ctx.role !== 'teacher') redirect(isAdminRole(ctx.role) ? '/admin/dashboard' : '/forbidden');
  return ctx;
}

export function todayIn(tz: string, d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function fmtDate(iso: string | null | undefined, tz = 'UTC') {
  if (!iso) return '–';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00Z') : new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : tz, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

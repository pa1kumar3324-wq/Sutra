import type { Metadata } from 'next';
import { Badge, Card, Field, Flash, PageHeader, Select, Table, Td, btn, input, statusTone } from '@/components/ui';
import { inviteStaff, setMemberStatus } from '@/lib/actions/admin';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Teachers and staff' };

export default async function Teachers({ searchParams: sp }: { searchParams: { ok?: string; error?: string } }) {
  const ctx = await requireAdmin();
  const { data } = await ctx.supabase.from('organization_memberships').select('id, role, status, user_id, profiles(display_name, email)').eq('organization_id', ctx.orgId).order('created_at');
  return (
    <>
      <PageHeader title="Teachers and staff" /><Flash ok={sp.ok} error={sp.error} />
      <Card title="Invite staff" className="mb-4"><form action={inviteStaff} className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <Field label="Name" name="display_name" required><input id="display_name" name="display_name" required className={input} /></Field>
        <Field label="Email" name="email" required><input id="email" name="email" type="email" required className={input} /></Field>
        <Field label="Role" name="role" required><Select name="role"><option value="teacher">Teacher</option>{ctx.role === 'owner' && <option value="admin">Administrator</option>}</Select></Field>
        <button className={btn}>Send invitation</button></form>
        <p className="mt-2 text-xs text-muted">They receive a one-time link to set a password. Access can be revoked at any time.</p></Card>
      <Table head={['Name', 'Email', 'Role', 'Status', '']}>{(data as any[] ?? []).map((m) => (
        <tr key={m.id}><Td>{m.profiles?.display_name}</Td><Td>{m.profiles?.email}</Td><Td>{m.role}</Td><Td><Badge tone={statusTone(m.status)}>{m.status}</Badge></Td>
          <Td>{m.user_id !== ctx.userId && m.role !== 'owner' && m.status !== 'invited' && (<form action={setMemberStatus}><input type="hidden" name="membership_id" value={m.id} /><input type="hidden" name="status" value={m.status === 'active' ? 'deactivated' : 'active'} />
            <button className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold">{m.status === 'active' ? 'Deactivate' : 'Reactivate'}</button></form>)}</Td></tr>))}</Table>
    </>
  );
}

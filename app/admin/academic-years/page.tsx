import type { Metadata } from 'next';
import { Badge, Card, Field, Flash, PageHeader, Table, Td, btn, input, statusTone } from '@/components/ui';
import { createYear, setYearStatus } from '@/lib/actions/admin';
import { fmtDate, requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Academic years' };

export default async function Years({ searchParams: sp }: { searchParams: { ok?: string; error?: string } }) {
  const ctx = await requireAdmin();
  const { data } = await ctx.supabase.from('academic_years').select('*').eq('organization_id', ctx.orgId).order('start_date', { ascending: false });
  return (
    <>
      <PageHeader title="Academic years" /><Flash ok={sp.ok} error={sp.error} />
      <Card title="New academic year" className="mb-4"><form action={createYear} className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <Field label="Name" name="name" required><input id="name" name="name" required className={input} placeholder="2026-27" /></Field>
        <Field label="Starts" name="start_date" required><input id="start_date" name="start_date" type="date" required className={input} /></Field>
        <Field label="Ends" name="end_date" required><input id="end_date" name="end_date" type="date" required className={input} /></Field><button className={btn}>Create</button></form></Card>
      <Table head={['Year', 'Dates', 'Status', '']}>{(data as any[] ?? []).map((y) => (
        <tr key={y.id}><Td>{y.name}</Td><Td>{fmtDate(y.start_date)} – {fmtDate(y.end_date)}</Td><Td><Badge tone={statusTone(y.status)}>{y.status}</Badge></Td>
          <Td><form action={setYearStatus}><input type="hidden" name="year_id" value={y.id} /><input type="hidden" name="status" value={y.status === 'closed' ? 'active' : 'closed'} /><button className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold">{y.status === 'closed' ? 'Reopen' : 'Close year'}</button></form></Td></tr>))}</Table>
    </>
  );
}

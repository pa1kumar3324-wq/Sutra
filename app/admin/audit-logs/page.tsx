import type { Metadata } from 'next';
import { Empty, PageHeader, Pager, Table, Td } from '@/components/ui';
import { fmtDate, requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Audit log' };

const PAGE = 40;
export default async function Audit({ searchParams }: { searchParams: { page?: string } }) {
  const ctx = await requireAdmin();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { data, count } = await ctx.supabase.from('audit_logs').select('id, action, entity_type, metadata, created_at, profiles(display_name)', { count: 'exact' })
    .eq('organization_id', ctx.orgId).order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const rows = (data ?? []) as any[];
  return (
    <>
      <PageHeader title="Audit log" sub="Append-only record of administrative and record-changing actions. No notes or personal details are stored here." />
      {rows.length === 0 ? <Empty title="Nothing logged yet" /> : <>
        <Table head={['When', 'Who', 'Action', 'Record', 'Details']}>{rows.map((r) => (
          <tr key={r.id}><Td>{fmtDate(r.created_at, ctx.timezone)} {new Date(r.created_at).toLocaleTimeString('en-GB', { timeZone: ctx.timezone, hour: '2-digit', minute: '2-digit' })}</Td><Td>{r.profiles?.display_name ?? 'system'}</Td><Td>{r.action}</Td><Td>{r.entity_type}</Td>
            <Td className="text-xs text-muted">{Object.entries(r.metadata ?? {}).filter(([k]) => k !== 'op').map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</Td></tr>))}</Table>
        <Pager base="/admin/audit-logs" page={page} pageSize={PAGE} total={count ?? 0} /></>}
    </>
  );
}

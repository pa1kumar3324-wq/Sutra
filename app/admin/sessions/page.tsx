import type { Metadata } from 'next';
import { Badge, Empty, PageHeader, Pager, Table, Td, statusTone } from '@/components/ui';
import { fmtDate, requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Sessions' };

const PAGE = 25;
export default async function Sessions({ searchParams }: { searchParams: { page?: string } }) {
  const ctx = await requireAdmin();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { data, count } = await ctx.supabase.from('class_sessions')
    .select('id, session_date, status, classes(name), subjects(name), profiles(display_name), assessments(status), session_topics(topics(name))', { count: 'exact' })
    .eq('organization_id', ctx.orgId).order('session_date', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const rows = (data ?? []) as any[];
  return (
    <>
      <PageHeader title="Sessions" sub="Every class session recorded across the trust (read-only)." />
      {rows.length === 0 ? <Empty title="No sessions yet" hint="Teachers create sessions from their class pages." /> : <>
        <Table head={['Date', 'Class', 'Subject', 'Teacher', 'Topics', 'Assessment']}>{rows.map((s) => {
          const st = (Array.isArray(s.assessments) ? s.assessments[0]?.status : s.assessments?.status) ?? 'pending';
          return <tr key={s.id}><Td>{fmtDate(s.session_date)}</Td><Td>{s.classes?.name}</Td><Td>{s.subjects?.name}</Td><Td>{s.profiles?.display_name}</Td>
            <Td>{(s.session_topics ?? []).map((t: any) => t.topics?.name).join(', ')}</Td><Td><Badge tone={statusTone(st)}>{st.replace('_', ' ')}</Badge></Td></tr>; })}</Table>
        <Pager base="/admin/sessions" page={page} pageSize={PAGE} total={count ?? 0} /></>}
    </>
  );
}

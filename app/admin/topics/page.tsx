import type { Metadata } from 'next';
import { Badge, Card, Empty, Field, Flash, PageHeader, Select, Table, Td, btn, btn2, input, statusTone } from '@/components/ui';
import { createTopic, setTopicStatus } from '@/lib/actions/admin';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Topics' };

export default async function Topics({ searchParams: sp }: { searchParams: { ok?: string; error?: string; subject_id?: string } }) {
  const ctx = await requireAdmin();
  const [{ data: subjects }, tq] = await Promise.all([
    ctx.supabase.from('subjects').select('id, name').eq('organization_id', ctx.orgId).eq('status', 'active').order('name'),
    (() => { let q = ctx.supabase.from('topics').select('id, name, status, subjects(name)').eq('organization_id', ctx.orgId).order('name'); if (sp.subject_id) q = q.eq('subject_id', sp.subject_id); return q; })(),
  ]);
  return (
    <>
      <PageHeader title="Topics" sub="Topics are what teachers pick for each session and assess." /><Flash ok={sp.ok} error={sp.error} />
      {(subjects ?? []).length === 0 ? <Empty title="Add a subject first" /> : <>
        <Card title="New topic" className="mb-4"><form action={createTopic} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Subject" name="subject_id" required><Select name="subject_id" required defaultValue={sp.subject_id}>{(subjects as any[]).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Topic name" name="name" required><input id="name" name="name" required className={input} placeholder="Fractions" /></Field><button className={btn}>Add topic</button></form></Card>
        <form className="mb-3 flex gap-2"><Select name="subject_id" defaultValue={sp.subject_id ?? ''}><option value="">All subjects</option>{(subjects as any[]).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><button className={btn2}>Filter</button></form></>}
      {(tq.data ?? []).length === 0 ? <Empty title="No topics yet" /> : <Table head={['Topic', 'Subject', 'Status', '']}>{(tq.data as any[]).map((t) => (
        <tr key={t.id}><Td>{t.name}</Td><Td>{t.subjects?.name}</Td><Td><Badge tone={statusTone(t.status)}>{t.status}</Badge></Td>
          <Td><form action={setTopicStatus}><input type="hidden" name="topic_id" value={t.id} /><input type="hidden" name="status" value={t.status === 'active' ? 'archived' : 'active'} /><button className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold">{t.status === 'active' ? 'Archive' : 'Restore'}</button></form></Td></tr>))}</Table>}
    </>
  );
}

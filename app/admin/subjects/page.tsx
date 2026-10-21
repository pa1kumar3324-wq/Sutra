import type { Metadata } from 'next';
import { Badge, Card, Empty, Field, Flash, PageHeader, Table, Td, btn, input, statusTone } from '@/components/ui';
import { createSubject } from '@/lib/actions/admin';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Subjects' };

export default async function Subjects({ searchParams: sp }: { searchParams: { ok?: string; error?: string } }) {
  const ctx = await requireAdmin();
  const { data } = await ctx.supabase.from('subjects').select('id, name, description, status, topics(id)').eq('organization_id', ctx.orgId).order('name');
  return (
    <>
      <PageHeader title="Subjects" /><Flash ok={sp.ok} error={sp.error} />
      <Card title="New subject" className="mb-4"><form action={createSubject} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <Field label="Name" name="name" required><input id="name" name="name" required className={input} placeholder="Mathematics" /></Field>
        <Field label="Description" name="description"><input id="description" name="description" className={input} /></Field><button className={btn}>Add</button></form></Card>
      {(data ?? []).length === 0 ? <Empty title="No subjects yet" /> : <Table head={['Subject', 'Topics', 'Status']}>{(data as any[]).map((s) => <tr key={s.id}><Td>{s.name}</Td><Td>{(s.topics ?? []).length}</Td><Td><Badge tone={statusTone(s.status)}>{s.status}</Badge></Td></tr>)}</Table>}
    </>
  );
}

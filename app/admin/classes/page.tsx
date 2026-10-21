import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, Empty, Field, Flash, PageHeader, Select, Table, Td, btn, input, statusTone } from '@/components/ui';
import { createClass } from '@/lib/actions/admin';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Classes' };

export default async function Classes({ searchParams: sp }: { searchParams: { ok?: string; error?: string } }) {
  const ctx = await requireAdmin();
  const [{ data: classes }, { data: years }] = await Promise.all([
    ctx.supabase.from('classes').select('id, name, grade_level, section, status, academic_years(name), enrollments(status)').eq('organization_id', ctx.orgId).order('grade_level').order('name'),
    ctx.supabase.from('academic_years').select('id, name').eq('organization_id', ctx.orgId).order('start_date', { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="Classes" />
      <Flash ok={sp.ok} error={sp.error} />
      {(years ?? []).length === 0 ? <Empty title="Create an academic year first" action={<Link className="font-semibold text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href="/admin/academic-years">Academic years</Link>} /> : (
        <Card title="New class" className="mb-4"><form action={createClass} className="grid gap-3 sm:grid-cols-4">
          <Field label="Name" name="name" required><input id="name" name="name" required className={input} placeholder="Grade 5" /></Field>
          <Field label="Grade" name="grade_level" required><input id="grade_level" name="grade_level" required className={input} placeholder="5" /></Field>
          <Field label="Section" name="section"><input id="section" name="section" className={input} /></Field>
          <Field label="Academic year" name="academic_year_id" required><Select name="academic_year_id" required>{(years ?? []).map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}</Select></Field>
          <div className="sm:col-span-4"><button className={btn}>Create class</button></div></form></Card>)}
      {(classes ?? []).length === 0 ? <Empty title="No classes yet" /> : (
        <Table head={['Class', 'Grade', 'Year', 'Students', 'Status']}>
          {(classes as any[]).map((c) => <tr key={c.id}><Td><Link className="font-medium text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href={`/admin/classes/${c.id}`}>{c.name}{c.section ? ` ${c.section}` : ''}</Link></Td><Td>{c.grade_level}</Td><Td>{c.academic_years?.name}</Td>
            <Td>{(c.enrollments ?? []).filter((e: any) => e.status === 'active').length}</Td><Td><Badge tone={statusTone(c.status)}>{c.status}</Badge></Td></tr>)}
        </Table>)}
    </>
  );
}

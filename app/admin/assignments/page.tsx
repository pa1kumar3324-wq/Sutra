import type { Metadata } from 'next';
import { Badge, Card, Empty, Field, Flash, PageHeader, Select, Table, Td, btn, statusTone } from '@/components/ui';
import { createAssignment, endAssignment } from '@/lib/actions/admin';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Teaching assignments' };

export default async function Assignments({ searchParams: sp }: { searchParams: { ok?: string; error?: string } }) {
  const ctx = await requireAdmin(); const sb = ctx.supabase;
  const [classes, subjects, teachers, asg] = await Promise.all([
    sb.from('classes').select('id, name').eq('organization_id', ctx.orgId).eq('status', 'active').order('name'),
    sb.from('subjects').select('id, name').eq('organization_id', ctx.orgId).eq('status', 'active').order('name'),
    sb.from('organization_memberships').select('user_id, profiles(display_name)').eq('organization_id', ctx.orgId).eq('status', 'active').in('role', ['teacher', 'admin', 'owner']),
    sb.from('teaching_assignments').select('id, status, classes(name), subjects(name), profiles(display_name)').eq('organization_id', ctx.orgId).order('status').order('created_at', { ascending: false }),
  ]);
  const ready = (classes.data ?? []).length && (subjects.data ?? []).length && (teachers.data ?? []).length;
  return (
    <>
      <PageHeader title="Teaching assignments" sub="A class can have several subjects; a teacher can teach several classes." /><Flash ok={sp.ok} error={sp.error} />
      {!ready ? <Empty title="You need a class, a subject and a teacher first" /> : (
        <Card title="Assign a teacher" className="mb-4"><form action={createAssignment} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="Class" name="class_id" required><Select name="class_id" required>{(classes.data as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Subject" name="subject_id" required><Select name="subject_id" required>{(subjects.data as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Teacher" name="teacher_user_id" required><Select name="teacher_user_id" required>{(teachers.data as any[]).map((t) => <option key={t.user_id} value={t.user_id}>{t.profiles?.display_name}</option>)}</Select></Field>
          <button className={btn}>Assign</button></form></Card>)}
      <Table head={['Class', 'Subject', 'Teacher', 'Status', '']}>{(asg.data as any[] ?? []).map((a) => (
        <tr key={a.id}><Td>{a.classes?.name}</Td><Td>{a.subjects?.name}</Td><Td>{a.profiles?.display_name}</Td><Td><Badge tone={statusTone(a.status)}>{a.status}</Badge></Td>
          <Td>{a.status === 'active' && <form action={endAssignment}><input type="hidden" name="assignment_id" value={a.id} /><button className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold">End</button></form>}</Td></tr>))}</Table>
    </>
  );
}

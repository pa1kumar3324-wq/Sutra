import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, Flash, PageHeader, Table, Td, btn2, btnDanger, statusTone } from '@/components/ui';
import { setClassStatus } from '@/lib/actions/admin';
import { fmtDate, requireAdmin } from '@/lib/auth/session';
import { attendanceSummary } from '@/lib/domain/attendance';

export default async function ClassPage({ params, searchParams }: { params: { classId: string }; searchParams: { ok?: string; error?: string } }) {
  const ctx = await requireAdmin(); const sb = ctx.supabase;
  const { data: cls } = await sb.from('classes').select('id, name, grade_level, status, academic_years(name)').eq('id', params.classId).eq('organization_id', ctx.orgId).maybeSingle();
  if (!cls) notFound();
  const [asg, enr, ses, att] = await Promise.all([
    sb.from('teaching_assignments').select('id, status, subjects(name), profiles(display_name)').eq('class_id', params.classId).order('status'),
    sb.from('enrollments').select('status, students(id, full_name, student_code)').eq('class_id', params.classId).eq('status', 'active'),
    sb.from('class_sessions').select('id, session_date, status, subjects(name), topics:session_topics(topics(name))').eq('class_id', params.classId).order('session_date', { ascending: false }).limit(15),
    sb.from('attendance_records').select('status, class_sessions!inner(class_id)').eq('class_sessions.class_id', params.classId).limit(20000),
  ]);
  const a = attendanceSummary(((att.data ?? []) as any[]).map((r) => r.status));
  const c = cls as any;
  return (
    <>
      <PageHeader title={c.name} sub={`Grade ${c.grade_level} · ${c.academic_years?.name}`} actions={
        <form action={setClassStatus}><input type="hidden" name="class_id" value={c.id} /><input type="hidden" name="status" value={c.status === 'active' ? 'archived' : 'active'} />
          <button className={c.status === 'active' ? btnDanger : btn2}>{c.status === 'active' ? 'Archive class' : 'Restore class'}</button></form>} />
      <Flash ok={searchParams.ok} error={searchParams.error} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Teachers and subjects">{(asg.data ?? []).length === 0 ? <p className="text-sm text-muted">None assigned. <Link className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href="/admin/assignments">Assign</Link></p> :
          <ul className="space-y-1 text-sm">{(asg.data as any[]).map((x) => <li key={x.id}>{x.subjects?.name}: {x.profiles?.display_name} <Badge tone={statusTone(x.status)}>{x.status}</Badge></li>)}</ul>}</Card>
        <Card title="Attendance (all sessions)"><p className="text-sm">{a.percentage === null ? 'No attendance recorded yet.' : <><strong className="text-xl">{a.percentage}%</strong> ({a.present + a.late} attended of {a.eligible} eligible)</>}</p></Card>
      </div>
      <h2 className="mb-2 mt-6 font-semibold">Enrolled students ({(enr.data ?? []).length})</h2>
      <Table head={['Name', 'Code']}>{(enr.data as any[] ?? []).map((e) => <tr key={e.students.id}><Td><Link className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href={`/admin/students/${e.students.id}`}>{e.students.full_name}</Link></Td><Td>{e.students.student_code}</Td></tr>)}</Table>
      <h2 className="mb-2 mt-6 font-semibold">Recent sessions</h2>
      <Table head={['Date', 'Subject', 'Topics', 'Status']}>{(ses.data as any[] ?? []).map((s) => <tr key={s.id}><Td>{fmtDate(s.session_date)}</Td><Td>{s.subjects?.name}</Td><Td>{(s.topics ?? []).map((t: any) => t.topics?.name).join(', ')}</Td><Td><Badge tone={statusTone(s.status)}>{s.status}</Badge></Td></tr>)}</Table>
    </>
  );
}

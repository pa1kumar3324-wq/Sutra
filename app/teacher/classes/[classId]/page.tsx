import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, PageHeader, btn, statusTone } from '@/components/ui';
import { fmtDate, requireTeacher } from '@/lib/auth/session';
import { attendanceSummary } from '@/lib/domain/attendance';

export default async function TeacherClass({ params }: { params: { classId: string } }) {
  const ctx = await requireTeacher(); const sb = ctx.supabase;
  const { data: cls } = await sb.from('classes').select('id, name, grade_level').eq('id', params.classId).maybeSingle();   // RLS: only classes you teach
  if (!cls) notFound();
  const [asg, enr, ses, att] = await Promise.all([
    sb.from('teaching_assignments').select('id, subjects(name)').eq('class_id', params.classId).eq('teacher_user_id', ctx.userId).eq('status', 'active'),
    sb.from('enrollments').select('students(id, full_name, student_code)').eq('class_id', params.classId).eq('status', 'active'),
    sb.from('class_sessions').select('id, session_date, status, subjects(name), assessments(status)').eq('class_id', params.classId).eq('teacher_user_id', ctx.userId).order('session_date', { ascending: false }).limit(10),
    sb.from('attendance_records').select('status, class_sessions!inner(class_id)').eq('class_sessions.class_id', params.classId).limit(20000),
  ]);
  const a = attendanceSummary(((att.data ?? []) as any[]).map((r) => r.status));
  return (
    <>
      <PageHeader title={(cls as any).name} sub={`Grade ${(cls as any).grade_level} · ${((asg.data ?? []) as any[]).map((x) => x.subjects?.name).join(', ')}`} actions={<Link className={btn} href={`/teacher/classes/${params.classId}/sessions/new`}>Start a session</Link>} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`Students (${(enr.data ?? []).length})`}><ul className="divide-y divide-line text-sm">{((enr.data ?? []) as any[]).map((e) => <li key={e.students.id} className="py-2"><Link className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href={`/teacher/students/${e.students.id}`}>{e.students.full_name}</Link> <span className="text-muted">{e.students.student_code}</span></li>)}</ul></Card>
        <div className="space-y-4">
          <Card title="Attendance (your sessions)"><p className="text-sm">{a.percentage === null ? 'No attendance recorded yet.' : <><strong className="text-xl">{a.percentage}%</strong> attended</>}</p></Card>
          <Card title="Recent sessions"><ul className="space-y-2 text-sm">{((ses.data ?? []) as any[]).map((s) => { const st = (Array.isArray(s.assessments) ? s.assessments[0]?.status : s.assessments?.status) ?? 'pending';
            return <li key={s.id}><Link className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href={`/teacher/sessions/${s.id}`}>{fmtDate(s.session_date)} · {s.subjects?.name}</Link> <Badge tone={statusTone(st)}>assessment {st.replace('_', ' ')}</Badge></li>; })}</ul></Card>
        </div>
      </div>
    </>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Badge, Card, Empty, PageHeader, SectionTitle, link, statusTone } from '@/components/ui';
import { OUTCOME_META } from '@/components/status';
import type { Outcome } from '@/lib/domain/assessment';
import { fmtDate, requireTeacher } from '@/lib/auth/session';
import { statusesByStudentTopic } from '@/lib/domain/progress';
import { fetchResults } from '@/lib/reports';

export const metadata: Metadata = { title: 'Today' };

export default async function TeacherDashboard() {
  const ctx = await requireTeacher(); const sb = ctx.supabase;
  const { data: assignments } = await sb.from('teaching_assignments').select('id, class_id, classes(name), subjects(name)').eq('teacher_user_id', ctx.userId).eq('status', 'active');
  const asg = (assignments ?? []) as any[];
  if (asg.length === 0) return <><PageHeader title="Today" /><Empty title="You haven’t been assigned a class yet" hint="A trust administrator assigns you a class and subject. Once they do, it will show up here." /></>;

  const { data: sessions } = await sb.from('class_sessions').select('id, session_date, status, class_id, classes(name), subjects(name), assessments(status), attendance_records(id)')
    .eq('teacher_user_id', ctx.userId).order('session_date', { ascending: false }).limit(12);
  const rosterSizes = new Map<string, number>();
  await Promise.all([...new Set(asg.map((a) => a.class_id))].map(async (cid) => {
    const { count } = await sb.from('enrollments').select('id', { count: 'exact', head: true }).eq('class_id', cid).eq('status', 'active'); rosterSizes.set(cid, count ?? 0);
  }));
  const rows = ((sessions ?? []) as any[]).map((s) => {
    const a = Array.isArray(s.assessments) ? s.assessments[0]?.status : s.assessments?.status;
    return { ...s, asmt: a ?? 'pending', attIncomplete: (s.attendance_records ?? []).length < (rosterSizes.get(s.class_id) ?? 0) };
  });
  const todo = rows.filter((r) => r.attIncomplete || r.asmt !== 'completed');
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const results = await fetchResults(ctx, { from, to: new Date().toISOString().slice(0, 10) });
  const flagged = statusesByStudentTopic(results.map((r) => ({ studentId: r.student_id, topicId: r.topic_id, date: r.date, outcome: r.outcome })), new Date()).filter((s) => s.status.current !== 'understood');
  const sName = new Map(results.map((r) => [r.student_id, r.student])); const tName = new Map(results.map((r) => [r.topic_id, r.topic]));

  return (
    <>
      <PageHeader title="Today" sub={`Hello ${ctx.displayName.split(' ')[0]}.`} />
      <div className="grid gap-3 sm:grid-cols-2">{asg.map((a) => (
        <Link key={a.id} href={`/teacher/classes/${a.class_id}`} className="panel group flex items-center justify-between gap-3 p-4 transition-colors hover:border-gold/50">
          <span><span className="block font-semibold">{a.classes?.name}</span><span className="block text-sm text-muted">{a.subjects?.name}</span></span>
          <ChevronRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" aria-hidden />
        </Link>))}</div>

      <SectionTitle>Needs your attention</SectionTitle>
      {todo.length === 0 ? <p className="panel flex items-center gap-2 p-4 text-sm text-muted"><CheckCircle2 size={16} className="text-ok" aria-hidden />Everything is up to date.</p> : (
        <ul className="space-y-2">{todo.map((s) => (
          <li key={s.id} className="panel p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium">{s.classes?.name} <span className="text-muted">· {s.subjects?.name} · {fmtDate(s.session_date)}</span></span>
            <span className="flex flex-wrap gap-2">{s.attIncomplete && <Link href={`/teacher/sessions/${s.id}/attendance`}><Badge tone="warn">Attendance incomplete</Badge></Link>}
              {s.asmt !== 'completed' && <Link href={`/teacher/sessions/${s.id}/assessment`}><Badge tone={statusTone(s.asmt)}>Assessment {s.asmt.replace('_', ' ')}</Badge></Link>}</span></div></li>))}</ul>)}

      <SectionTitle note="Based on each student’s latest result per topic.">Revision recommended (last 30 days)</SectionTitle>
      {flagged.length === 0 ? <p className="panel p-4 text-sm text-muted">No topics flagged right now.</p> : (
        <Card><ul className="divide-y divide-line text-sm">{flagged.slice(0, 12).map((f) => {
          const { Icon, chip } = OUTCOME_META[f.status.current as Outcome];
          return (
            <li key={f.studentId + f.topicId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <span><Link className={link} href={`/teacher/students/${f.studentId}`}>{sName.get(f.studentId)}</Link> <span className="text-muted">· {tName.get(f.topicId)}</span></span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${chip}`}><Icon size={13} aria-hidden />{f.status.current === 'didnt_understand' ? 'Needs follow-up' : 'Revision recommended'}</span>
            </li>); })}</ul></Card>)}

      <SectionTitle>Recent sessions</SectionTitle>
      <ul className="space-y-2">{rows.slice(0, 6).map((s) => <li key={s.id}><Link className="panel flex flex-wrap items-center justify-between gap-2 p-3 text-sm transition-colors hover:border-gold/50 sm:p-4" href={`/teacher/sessions/${s.id}`}><span>{s.classes?.name} <span className="text-muted">· {s.subjects?.name} · {fmtDate(s.session_date)}</span></span> <Badge tone={statusTone(s.status)}>{s.status.replace('_', ' ')}</Badge></Link></li>)}</ul>
    </>
  );
}

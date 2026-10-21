import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Empty, PageHeader, Progress, Stat, btn } from '@/components/ui';
import { requireAdmin, todayIn } from '@/lib/auth/session';
import { fetchCompletion, fetchResults } from '@/lib/reports';
import { statusesByStudentTopic, strugglingTopics } from '@/lib/domain/progress';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const ctx = await requireAdmin();
  const today = todayIn(ctx.timezone);
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const count = async (t: string, f?: (q: any) => any) => {
    let q = ctx.supabase.from(t).select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId);
    if (f) q = f(q); const { count: c } = await q; return c ?? 0;
  };
  const [students, classes, teachers, sessions30, completion, results, topics] = await Promise.all([
    count('students', (q) => q.eq('enrollment_status', 'active')), count('classes', (q) => q.eq('status', 'active')),
    count('organization_memberships', (q) => q.eq('role', 'teacher').eq('status', 'active')),
    count('class_sessions', (q) => q.gte('session_date', from)),
    fetchCompletion(ctx, { from, to: today }), fetchResults(ctx, { from, to: today }),
    ctx.supabase.from('topics').select('id, name').eq('organization_id', ctx.orgId),
  ]);
  const names = new Map(((topics.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]));
  const struggling = strugglingTopics(statusesByStudentTopic(results.map((r) => ({ studentId: r.student_id, topicId: r.topic_id, date: r.date, outcome: r.outcome })), new Date())).slice(0, 5);
  return (
    <>
      <PageHeader title="Dashboard" sub={`${ctx.orgName} · last 30 days unless stated`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active students" value={students} href="/admin/students" />
        <Stat label="Active classes" value={classes} href="/admin/classes" />
        <Stat label="Active teachers" value={teachers} href="/admin/teachers" />
        <Stat label="Sessions held" value={sessions30} href="/admin/sessions" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Assessment completion">
          {completion.sessions === 0 ? <p className="text-sm text-muted">No sessions in this period.</p> : (
            <>
              <p className="text-sm"><strong className="tnum text-3xl font-semibold tracking-tight">{Math.round((completion.completed / completion.sessions) * 100)}%</strong> <span className="text-muted">of {completion.sessions} sessions have a completed assessment.</span></p>
              <div className="mt-4"><Progress value={completion.completed} max={completion.sessions} label="Sessions with a completed assessment" /></div>
            </>)}
        </Card>
        <Card title="Topics many students are finding hard">
          {struggling.length === 0 ? <p className="text-sm text-muted">No topic currently stands out.</p> : (
            <ul className="divide-y divide-line text-sm">{struggling.map((s) => <li key={s.topicId} className="flex items-baseline justify-between gap-4 py-2 first:pt-0"><strong className="font-medium">{names.get(s.topicId) ?? 'Topic'}</strong><span className="tnum shrink-0 text-muted">{s.struggling} of {s.assessed} students</span></li>)}</ul>)}
          <p className="mt-3 text-xs text-muted">Students who need follow-up or revision, based on each student’s latest result per topic, from assessments in the last 30 days.</p>
        </Card>
      </div>
      {students === 0 && <div className="mt-4"><Empty title="Start by registering students" hint="Create an academic year, a class and a subject, then add students and assign teachers." action={<Link className={btn} href="/admin/academic-years">Set up academic year</Link>} /></div>}
    </>
  );
}

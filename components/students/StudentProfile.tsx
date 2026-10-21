import { notFound } from 'next/navigation';
import { Badge, Card, Empty } from '@/components/ui';
import { OUTCOME_META } from '@/components/status';
import { fmtDate, type Ctx } from '@/lib/auth/session';
import { attendanceSummary } from '@/lib/domain/attendance';
import { OUTCOME_LABEL, type Attendance, type Outcome } from '@/lib/domain/assessment';
import { FLAG_LABEL, topicStatus, type TopicFlag } from '@/lib/domain/progress';


type Res = { outcome: Outcome; topic_id: string; topics: { name: string; subjects: { name: string } | null } | null; class_sessions: { session_date: string } | null };

export async function StudentProfile({ ctx, studentId }: { ctx: Ctx; studentId: string }) {
  const sb = ctx.supabase;
  const { data: student } = await sb.from('students').select('*').eq('id', studentId).eq('organization_id', ctx.orgId).maybeSingle();
  if (!student) notFound();
  const [enr, att, res, obs] = await Promise.all([
    sb.from('enrollments').select('id, status, start_date, end_date, classes(name, grade_level), academic_years(name)').eq('student_id', studentId).order('start_date', { ascending: false }),
    sb.from('attendance_records').select('status').eq('student_id', studentId),
    sb.from('assessment_results').select('outcome, topic_id, topics(name, subjects(name)), class_sessions(session_date)').eq('student_id', studentId).limit(5000),
    sb.from('learning_observations').select('observation, created_at').eq('student_id', studentId).order('created_at', { ascending: false }).limit(8),
  ]);
  const enrollments = (enr.data ?? []) as any[];
  const a = attendanceSummary(((att.data ?? []) as { status: Attendance }[]).map((r) => r.status));
  const results = (res.data ?? []) as unknown as Res[];
  const today = new Date();

  // group: subject -> topic -> history
  const subjects = new Map<string, Map<string, { name: string; hist: { date: string; outcome: Outcome }[] }>>();
  for (const r of results) {
    const subj = r.topics?.subjects?.name ?? 'Other';
    if (!subjects.has(subj)) subjects.set(subj, new Map());
    const m = subjects.get(subj)!;
    if (!m.has(r.topic_id)) m.set(r.topic_id, { name: r.topics?.name ?? 'Topic', hist: [] });
    m.get(r.topic_id)!.hist.push({ date: r.class_sessions?.session_date ?? '', outcome: r.outcome });
  }
  const recs: { subject: string; topic: string; flag: TopicFlag }[] = [];
  const subjectBlocks = [...subjects.entries()].map(([subject, topics]) => ({
    subject,
    topics: [...topics.values()].map((t) => ({ ...t, hist: t.hist.sort((x, y) => x.date.localeCompare(y.date)), status: topicStatus(t.hist, today)! })),
  }));
  for (const b of subjectBlocks) for (const t of b.topics)
    for (const f of t.status.flags) if (['follow_up', 'revision', 'repeated_difficulty', 'stale'].includes(f)) recs.push({ subject: b.subject, topic: t.name, flag: f });

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="text-2xl font-semibold tracking-tight">{student.full_name}</h2><p className="mt-1 text-sm text-muted">Code <span className="font-mono">{student.student_code}</span> · School grade {student.current_school_grade}{student.school_name ? ` · ${student.school_name}` : ''}</p></div>
          <Badge tone={student.enrollment_status === 'active' ? 'ok' : 'neutral'}>{student.enrollment_status}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted">Joined {fmtDate(student.joined_at)}</p>
      </Card>

      <Card title="Revision recommendations">
        {recs.length === 0 ? <p className="text-sm text-muted">Nothing flagged from the assessments recorded so far.</p> : (
          <ul className="space-y-1.5 text-sm">{recs.map((r, i) => <li key={i} className="flex flex-wrap items-center gap-2"><Badge tone={r.flag === 'stale' ? 'neutral' : r.flag === 'follow_up' ? 'bad' : 'warn'}>{FLAG_LABEL[r.flag]}</Badge><span>{r.subject}: {r.topic}</span></li>)}</ul>)}
        <p className="mt-3 text-xs text-muted">Rules: follow-up = latest result is Didn’t Understand; revision = latest is Needs Revision; repeated difficulty = 2 of the last 3 results were not Understood; not assessed recently = more than 30 days.</p>
      </Card>

      <Card title="Learning progress by topic">
        {subjectBlocks.length === 0 ? <Empty title="No assessments yet" hint="Outcomes appear here after a teacher assesses a class." /> : subjectBlocks.map((b) => (
          <div key={b.subject} className="mb-4 last:mb-0">
            <h3 className="mb-2 font-semibold">{b.subject}</h3>
            <ul className="space-y-3">
              {b.topics.map((t) => { const cur = OUTCOME_META[t.status.current]; const Icon = cur.Icon; return (
                <li key={t.name} className="rounded-lg border border-line bg-inset/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{t.name}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cur.chip}`}><Icon size={13} aria-hidden />Currently: {OUTCOME_LABEL[t.status.current]}</span></div>
                  <ol className="mt-3 flex flex-wrap gap-1.5 text-xs">{t.hist.map((h, i) => { const m = OUTCOME_META[h.outcome]; const HI = m.Icon; return <li key={i} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${m.chip}`}><HI size={12} aria-hidden /><span className="text-muted">{fmtDate(h.date)}</span><span className="font-semibold">{OUTCOME_LABEL[h.outcome]}</span></li>; })}</ol>
                </li>); })}
            </ul>
          </div>))}
      </Card>

      <Card title="Attendance">
        {a.recorded === 0 ? <p className="text-sm text-muted">No attendance recorded yet.</p> : (
          <p className="text-sm"><strong className="tnum text-2xl font-semibold tracking-tight">{a.percentage === null ? '–' : `${a.percentage}%`}</strong> attended · {a.present} present, {a.late} late, {a.absent} absent, {a.excused} excused</p>)}
        <p className="mt-2 text-xs text-muted">Attendance % = (present + late) ÷ (present + late + absent). Excused sessions and sessions with no record are not counted.</p>
      </Card>

      <Card title="Enrolment history">
        {enrollments.length === 0 ? <p className="text-sm text-muted">Not enrolled in a class.</p> : (
          <ul className="space-y-1 text-sm">{enrollments.map((e) => <li key={e.id}>{e.classes?.name} · {e.academic_years?.name} · {fmtDate(e.start_date)} – {e.end_date ? fmtDate(e.end_date) : 'now'} <Badge tone={e.status === 'active' ? 'ok' : 'neutral'}>{e.status}</Badge></li>)}</ul>)}
      </Card>

      {(obs.data ?? []).length > 0 && (
        <Card title="Recent notes">
          <ul className="space-y-2 text-sm">{(obs.data as any[]).map((o, i) => <li key={i}><span className="text-xs text-muted">{fmtDate(o.created_at, ctx.timezone)}</span><br />{o.observation}</li>)}</ul>
        </Card>)}
    </div>
  );
}

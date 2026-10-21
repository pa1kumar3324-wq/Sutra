import Link from 'next/link';
import { Download } from 'lucide-react';
import { Badge, Card, Empty, Select, SectionTitle, Table, Td, btn, btn2, input, link } from '@/components/ui';
import { todayIn, type Ctx } from '@/lib/auth/session';
import { attendanceSummary, recentAbsenceStreak } from '@/lib/domain/attendance';
import { distribution, FLAG_LABEL, statusesByStudentTopic, strugglingTopics } from '@/lib/domain/progress';
import { OUTCOMES, OUTCOME_LABEL } from '@/lib/domain/assessment';
import { reportFilterSchema } from '@/lib/validations/schemas';
import { fetchAttendance, fetchCompletion, fetchResults, ROW_CAP } from '@/lib/reports';
import { OutcomeChart } from './OutcomeChart';

type SP = Record<string, string | undefined>;
const group = <T,>(rows: T[], key: (r: T) => string) => { const m = new Map<string, T[]>(); for (const r of rows) { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); } return m; };

export async function ReportsView({ ctx, sp, base }: { ctx: Ctx; sp: SP; base: string }) {
  const today = todayIn(ctx.timezone);
  const clean = Object.fromEntries(Object.entries({ from: sp.from || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10), to: sp.to || today,
    class_id: sp.class_id, subject_id: sp.subject_id, teacher_id: ctx.role === 'teacher' ? undefined : sp.teacher_id, outcome: sp.outcome }).filter(([, v]) => v));
  const parsed = reportFilterSchema.safeParse(clean);
  const [{ data: classes }, { data: subjects }, { data: teachers }] = await Promise.all([
    ctx.supabase.from('classes').select('id, name').eq('organization_id', ctx.orgId).order('name'),
    ctx.supabase.from('subjects').select('id, name').eq('organization_id', ctx.orgId).order('name'),
    ctx.role === 'teacher' ? Promise.resolve({ data: [] as any[] }) : ctx.supabase.from('organization_memberships').select('user_id, profiles(display_name)').eq('organization_id', ctx.orgId).eq('role', 'teacher'),
  ]);

  const form = (
    <form className="panel mb-6 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6" aria-label="Report filters">
      <label className="block text-sm font-medium [&>*]:mt-1.5 [&>*]:font-normal">From<input type="date" name="from" defaultValue={String(clean.from)} className={input} /></label>
      <label className="block text-sm font-medium [&>*]:mt-1.5 [&>*]:font-normal">To<input type="date" name="to" defaultValue={String(clean.to)} className={input} /></label>
      <label className="block text-sm font-medium [&>*]:mt-1.5 [&>*]:font-normal">Class<Select name="class_id" defaultValue={sp.class_id ?? ''}><option value="">All</option>{(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>
      <label className="block text-sm font-medium [&>*]:mt-1.5 [&>*]:font-normal">Subject<Select name="subject_id" defaultValue={sp.subject_id ?? ''}><option value="">All</option>{(subjects ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>
      {ctx.role !== 'teacher' ? <label className="block text-sm font-medium [&>*]:mt-1.5 [&>*]:font-normal">Teacher<Select name="teacher_id" defaultValue={sp.teacher_id ?? ''}><option value="">All</option>{(teachers ?? []).map((t: any) => <option key={t.user_id} value={t.user_id}>{t.profiles?.display_name}</option>)}</Select></label> : <span />}
      <label className="block text-sm font-medium [&>*]:mt-1.5 [&>*]:font-normal">Outcome<Select name="outcome" defaultValue={sp.outcome ?? ''}><option value="">All</option>{OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}</Select></label>
      <div className="sm:col-span-3 lg:col-span-6"><button className={btn2}>Apply filters</button></div>
    </form>
  );
  if (!parsed.success) return <>{form}<p role="alert" className="rounded-lg border border-bad/40 bg-bad-soft p-3 text-sm text-bad">{parsed.error.issues[0].message}</p></>;
  const f = parsed.data;

  const [att, res, completion] = await Promise.all([fetchAttendance(ctx, f), fetchResults(ctx, f), fetchCompletion(ctx, f)]);
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v) as [string, string][])).toString();

  // attendance
  const byClass = [...group(att, (r) => r.class).entries()].map(([name, rows]) => ({ name, s: attendanceSummary(rows.map((r) => r.status)) }));
  const byStudent = [...group(att, (r) => r.student_id).entries()].map(([id, rows]) => {
    const chrono = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    return { id, name: rows[0].student, code: rows[0].code, s: attendanceSummary(rows.map((r) => r.status)), streak: recentAbsenceStreak(chrono.map((r) => r.status)) };
  }).sort((a, b) => (a.s.percentage ?? 101) - (b.s.percentage ?? 101));
  const weekKey = (d: string) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const weekly = [...group(att, (r) => weekKey(r.date)).entries()].sort().map(([w, rows]) => ({ w, s: attendanceSummary(rows.map((r) => r.status)) }));

  // academic
  const bySubject = [...group(res, (r) => r.subject).entries()].map(([subject, rows]) => ({ subject, d: distribution(rows.map((r) => r.outcome)) }));
  const statuses = statusesByStudentTopic(res.map((r) => ({ studentId: r.student_id, topicId: r.topic_id, date: r.date, outcome: r.outcome })), new Date());
  const topicName = new Map(res.map((r) => [r.topic_id, `${r.subject}: ${r.topic}`]));
  const studentName = new Map(res.map((r) => [r.student_id, r.student]));
  const classOfStudent = new Map(res.map((r) => [r.student_id, r.class]));
  const struggling = strugglingTopics(statuses);
  const needFollowUp = statuses.filter((s) => s.status.flags.some((x) => ['follow_up', 'revision', 'repeated_difficulty'].includes(x)))
    .sort((a, b) => Number(b.status.flags.includes('repeated_difficulty')) - Number(a.status.flags.includes('repeated_difficulty'))).slice(0, 40);
  const improved = statuses.filter((s) => s.status.flags.includes('improved')).slice(0, 20);
  const truncated = att.length >= ROW_CAP || res.length >= ROW_CAP;

  return (
    <>
      {form}
      {truncated && <p role="alert" className="mb-4 rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm text-warn">Results were capped at {ROW_CAP} rows. Narrow the date range for complete figures.</p>}
      <div className="mb-2 flex flex-wrap gap-2">
        <Link className={btn} href={`/api/exports?kind=attendance&${qs}`}><Download size={16} aria-hidden />Download attendance CSV</Link>
        <Link className={btn2} href={`/api/exports?kind=assessments&${qs}`}><Download size={16} aria-hidden />Download assessments CSV</Link>
      </div>

      <SectionTitle>Attendance</SectionTitle>
      {att.length === 0 ? <Empty title="No attendance recorded in this range" /> : (
        <div className="space-y-4">
          <Table head={['Class', 'Attendance %', 'Present', 'Late', 'Absent', 'Excused']}>{byClass.map((c) => <tr key={c.name}><Td>{c.name}</Td><Td><strong>{c.s.percentage ?? '–'}{c.s.percentage !== null && '%'}</strong></Td><Td>{c.s.present}</Td><Td>{c.s.late}</Td><Td>{c.s.absent}</Td><Td>{c.s.excused}</Td></tr>)}</Table>
          <Card title="Weekly trend"><ul className="space-y-2 text-sm">{weekly.map((w) => (
            <li key={w.w} className="grid grid-cols-[120px_1fr_44px] items-center gap-3"><span className="tnum whitespace-nowrap text-muted">w/c {w.w}</span>
              <span className="h-2 overflow-hidden rounded-full bg-raised" aria-hidden><span className="block h-full rounded-full bg-gold" style={{ width: `${w.s.percentage ?? 0}%` }} /></span>
              <strong className="tnum text-right">{w.s.percentage ?? '–'}{w.s.percentage !== null && '%'}</strong></li>))}</ul></Card>
          <Card title="Students (lowest attendance first)"><ul className="divide-y divide-line text-sm">{byStudent.slice(0, 25).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><Link className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href={`${base.startsWith('/admin') ? '/admin' : '/teacher'}/students/${s.id}`}>{s.name}</Link> <span className="text-muted">{s.code}</span></span>
              <span>{s.s.percentage ?? '–'}{s.s.percentage !== null && '%'} · {s.s.absent} absent {s.streak >= 2 && <Badge tone="warn">{s.streak} absences in a row</Badge>}</span></li>))}</ul></Card>
        </div>)}
      <p className="mt-3 text-xs text-muted">Attendance % = (present + late) ÷ (present + late + absent). Excused sessions and sessions with no attendance record are not counted.</p>

      <SectionTitle note={<>{completion.sessions} sessions in range; {completion.completed} ({completion.sessions ? Math.round((completion.completed / completion.sessions) * 100) : 0}%) have a completed assessment. {res.length} outcomes recorded.</>}>Learning outcomes</SectionTitle>
      {res.length === 0 ? <Empty title="No assessments recorded in this range" /> : (
        <div className="space-y-4">
          <Card title="Outcomes by subject (counts in this range)">
            <OutcomeChart data={bySubject.map((b) => ({ subject: b.subject, Understood: b.d.understood, 'Needs Revision': b.d.needs_revision, "Didn't Understand": b.d.didnt_understand }))} />
            <div className="mt-3"><Table head={['Subject', 'Understood', 'Needs Revision', "Didn't Understand", 'Total']}>{bySubject.map((b) => <tr key={b.subject}><Td>{b.subject}</Td><Td>{b.d.understood}</Td><Td>{b.d.needs_revision}</Td><Td>{b.d.didnt_understand}</Td><Td>{b.d.total}</Td></tr>)}</Table></div>
            <p className="mt-2 text-xs text-muted">Counts of recorded outcomes only. Topics and students have different numbers of assessments, so compare with care.</p></Card>
          <Card title="Topics many students currently find hard">{struggling.length === 0 ? <p className="text-sm text-muted">No topic stands out in this range.</p> :
            <ul className="space-y-1 text-sm">{struggling.map((t) => <li key={t.topicId}><strong>{topicName.get(t.topicId)}</strong>: {t.struggling} of {t.assessed} assessed students need follow-up or revision</li>)}</ul>}</Card>
          <Card title="Students who may need follow-up">{needFollowUp.length === 0 ? <p className="text-sm text-muted">No follow-up flagged.</p> :
            <ul className="space-y-2 text-sm">{needFollowUp.map((s) => <li key={s.studentId + s.topicId}><strong>{studentName.get(s.studentId)}</strong> <span className="text-muted">({classOfStudent.get(s.studentId)})</span> · {topicName.get(s.topicId)} · {s.status.flags.filter((x) => x !== 'stale').map((x) => FLAG_LABEL[x]).join(', ')}</li>)}</ul>}
            <p className="mt-2 text-xs text-muted">Based on each student’s results within the selected range. Revision recommended means extra practice may help; it is not a judgement of ability.</p></Card>
          {improved.length > 0 && <Card title="Recent improvement"><ul className="space-y-1 text-sm">{improved.map((s) => <li key={s.studentId + s.topicId}>{studentName.get(s.studentId)} · {topicName.get(s.topicId)}</li>)}</ul></Card>}
        </div>)}
    </>
  );
}

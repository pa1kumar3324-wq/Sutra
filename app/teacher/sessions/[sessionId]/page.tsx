import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, Field, Flash, PageHeader, Progress, btn, btn2, input, statusTone } from '@/components/ui';
import { addTopic, updateSessionTopics } from '@/lib/actions/teacher';
import { fmtDate, requireTeacher } from '@/lib/auth/session';
import { assessmentCompletion } from '@/lib/domain/assessment';
import { loadSession } from '@/lib/session-data';

export const metadata: Metadata = { title: 'Session' };

export default async function SessionPage({ params, searchParams }: { params: { sessionId: string }; searchParams: { ok?: string; error?: string } }) {
  const ctx = await requireTeacher();
  const { session, students, topics, results, assessmentStatus } = await loadSession(ctx, params.sessionId);
  const { data: all } = await ctx.supabase.from('topics').select('id, name').eq('subject_id', session.subject_id).eq('status', 'active').order('name');
  const chosen = new Set(topics.map((t) => t.id));
  const c = assessmentCompletion({ students: students.map((s) => ({ id: s.id, attendance: s.attendance })), topicIds: topics.map((t) => t.id),
    results: Object.keys(results).map((k) => { const [studentId, topicId] = k.split('|'); return { studentId, topicId }; }) });
  const recorded = students.filter((s) => s.attendance).length;
  return (
    <>
      <PageHeader title={`${session.classes?.name} · ${session.subjects?.name}`} sub={<>{fmtDate(session.session_date)} · <Badge tone={statusTone(session.status)}>{session.status.replace('_', ' ')}</Badge></>} />
      <Flash ok={searchParams.ok} error={searchParams.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Attendance"><p className="tnum mb-2 text-sm text-muted">{recorded} of {students.length} students recorded.</p><div className="mb-4"><Progress value={recorded} max={students.length} label="Attendance recorded" /></div><Link className={recorded === students.length ? btn2 : btn} href={`/teacher/sessions/${params.sessionId}/attendance`}>{recorded === 0 ? 'Record attendance' : 'Review attendance'}</Link></Card>
        <Card title="Understanding"><p className="tnum mb-2 text-sm text-muted">{c.done} of {c.required} outcomes recorded · {assessmentStatus.replace('_', ' ')}</p><div className="mb-4"><Progress value={c.done} max={c.required} label="Outcomes recorded" /></div><Link className={btn} href={`/teacher/sessions/${params.sessionId}/assessment`}>{assessmentStatus === 'completed' ? 'Review / correct' : 'Assess students'}</Link></Card>
      </div>
      <Card title="Topics taught" className="mt-4">
        <form action={updateSessionTopics} className="space-y-3"><input type="hidden" name="session_id" value={params.sessionId} />
          <div className="grid gap-2 sm:grid-cols-2">{(all ?? []).map((t: any) => <label key={t.id} className="flex min-h-[44px] items-center gap-3 rounded-lg border border-line-strong bg-inset px-3 transition-colors hover:border-gold/50 has-[:checked]:border-gold/70 has-[:checked]:bg-brand-soft"><input type="checkbox" name="topic_ids" value={t.id} defaultChecked={chosen.has(t.id)} className="h-5 w-5 shrink-0" />{t.name}</label>)}</div>
          <Field label="Lesson notes" name="notes"><textarea id="notes" name="notes" rows={2} maxLength={2000} defaultValue={session.lesson_notes ?? ''} className={input} /></Field>
          <button className={btn2}>Save topics and notes</button>
          <p className="text-xs text-muted">Topics that already have assessment results cannot be removed.</p></form>
        <form action={addTopic} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-3"><input type="hidden" name="session_id" value={params.sessionId} /><input type="hidden" name="subject_id" value={session.subject_id} />
          <div className="min-w-[200px] flex-1"><label htmlFor="newtopic" className="text-sm font-medium">Add a new topic</label><input id="newtopic" name="name" required maxLength={120} className={input} /></div><button className={btn2}>Add</button></form>
      </Card>
    </>
  );
}

'use client';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, CircleDashed, Loader2, CircleAlert } from 'lucide-react';
import { completeAssessmentAction, saveAssessmentAction } from '@/lib/actions/teacher';
import { assessmentCompletion, ATTENDANCE_LABEL, OUTCOMES, OUTCOME_LABEL, type Attendance, type Outcome } from '@/lib/domain/assessment';
import { ATTENDANCE_META, OUTCOME_META } from '@/components/status';
import { Progress, btn, btn2, input, link } from '@/components/ui';

type Student = { id: string; name: string; code: string; attendance: Attendance | null };
type Topic = { id: string; name: string };
const key = (s: string, t: string) => `${s}|${t}`;
type Msg = { kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string };

export function AssessmentBoard({ sessionId, status, topics, students, initial }: {
  sessionId: string; status: 'pending' | 'in_progress' | 'completed'; topics: Topic[]; students: Student[]; initial: Record<string, Outcome>;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [cur, setCur] = useState(initial);
  const [obs, setObs] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<string>('all');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<Msg>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();
  const completed = status === 'completed';
  const topicName = Object.fromEntries(topics.map((t) => [t.id, t.name]));

  const dirtyKeys = useMemo(() => Object.keys(cur).filter((k) => cur[k] !== saved[k]), [cur, saved]);
  const dirtyObs = Object.entries(obs).filter(([, v]) => v.trim());
  const isDirty = dirtyKeys.length > 0 || dirtyObs.length > 0;
  const completion = assessmentCompletion({
    students: students.map((s) => ({ id: s.id, attendance: s.attendance })), topicIds: topics.map((t) => t.id),
    results: Object.keys(saved).map((k) => { const [studentId, topicId] = k.split('|'); return { studentId, topicId }; }),
  });

  useEffect(() => {                                    // protect unsaved work
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [isDirty]);

  const inFlight = useRef(false);
  function save(after?: () => void) {
    if (inFlight.current || !isDirty) { after?.(); return; }
    const results = dirtyKeys.map((k) => { const [student_id, topic_id] = k.split('|'); return { student_id, topic_id, outcome: cur[k] }; });
    const observations = dirtyObs.map(([student_id, observation]) => ({ student_id, observation: observation.trim() }));
    if (completed && results.some((r) => saved[key(r.student_id, r.topic_id)]) && !reason.trim()) {
      setMsg({ kind: 'error', text: 'Add a short reason for correcting a completed assessment.' }); return;
    }
    inFlight.current = true; setMsg({ kind: 'saving' });
    startTransition(async () => {
      const r = await saveAssessmentAction({ session_id: sessionId, results, observations, reason: reason || undefined });
      inFlight.current = false;
      if (r.ok) {                                      // confirmed by the server: only now mark as saved
        setSaved((p) => ({ ...p, ...Object.fromEntries(results.map((x) => [key(x.student_id, x.topic_id), x.outcome])) }));
        setObs({}); setReason('');
        setMsg({ kind: 'saved', text: `Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` });
        after?.();
      } else setMsg({ kind: 'error', text: r.error });  // choices remain on screen for retry
    });
  }
  // The timer below must call the *latest* save(). A closure captured when the timer was set still sees the old
  // "dirty" state, so after a manual "Save now" it would send the same results a second time and flip the status
  // back to "Saving…" a second later.
  const latestSave = useRef(save);
  useEffect(() => { latestSave.current = save; });
  // autosave shortly after a change (not for completed sessions, which need a reason)
  useEffect(() => {
    if (completed || dirtyKeys.length === 0 || msg.kind === 'error') return;
    const t = setTimeout(() => latestSave.current(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  function finish() {
    save(() => startTransition(async () => {
      const r = await completeAssessmentAction(sessionId);
      if (r.ok) router.refresh(); else setMsg({ kind: 'error', text: r.error });
    }));
  }

  const shown = focus === 'all' ? topics : topics.filter((t) => t.id === focus);
  const stateText = msg.kind === 'saving' ? 'Saving…' : msg.kind === 'error' ? `Save failed: ${msg.text} Your choices are still here.` : isDirty ? 'Unsaved changes' : msg.text ?? 'All changes saved';

  const pct = completion.required ? Math.round((completion.done / completion.required) * 100) : 0;
  return (
    <div>
      <div className="panel mb-4 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="tnum"><strong className="text-base">{completion.done}</strong> <span className="text-muted">of {completion.required} outcomes recorded ({pct}%)</span>
            {completion.attendanceMissing.length > 0 && <> · <Link className={link} href={`/teacher/sessions/${sessionId}/attendance`}>{completion.attendanceMissing.length} without attendance</Link></>}</p>
          {completed && <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok"><CheckCircle2 size={13} aria-hidden />Completed</span>}
        </div>
        <div className="mt-3"><Progress value={completion.done} max={completion.required} label="Outcomes recorded" tone={completion.done === completion.required && completion.required > 0 ? 'ok' : 'gold'} /></div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Key">
          {OUTCOMES.map((o) => { const { Icon, chip } = OUTCOME_META[o]; return <li key={o} className="inline-flex items-center gap-1.5"><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${chip}`}><Icon size={12} aria-hidden /></span>{OUTCOME_LABEL[o]}</li>; })}
        </ul>
        {topics.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <label htmlFor="focus" className="text-muted">Show</label>
            <select id="focus" value={focus} onChange={(e) => setFocus(e.target.value)} className={`${input} !w-auto min-w-[220px] pr-8`}>
              <option value="all">All topics (one card per student)</option>
              {topics.map((t) => <option key={t.id} value={t.id}>Only: {t.name}</option>)}
            </select>
          </div>)}
      </div>

      <ul className="space-y-3">
        {students.map((s) => {
          const absent = s.attendance === 'absent'; const none = s.attendance === null;
          const assessed = shown.filter((t) => cur[key(s.id, t.id)]).length;
          const allDone = !absent && !none && shown.length > 0 && assessed === shown.length;
          return (
            <li key={s.id} className="panel p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-raised text-xs font-semibold text-gold-light">{s.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <div><p className="font-semibold leading-tight">{s.name}</p><p className="mt-0.5 font-mono text-xs text-muted">{s.code}</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!absent && !none && <span className={`tnum inline-flex items-center gap-1.5 text-xs font-semibold ${allDone ? 'text-ok' : 'text-muted'}`}>{allDone ? <CheckCircle2 size={14} aria-hidden /> : <CircleDashed size={14} aria-hidden />}{assessed} of {shown.length} topic{shown.length === 1 ? '' : 's'}</span>}
                  {none
                    ? <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-raised px-2.5 py-0.5 text-xs font-semibold text-muted"><CircleAlert size={13} aria-hidden />Attendance not recorded</span>
                    : (() => { const { Icon, chip } = ATTENDANCE_META[s.attendance!]; return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${chip}`}><Icon size={13} aria-hidden />{ATTENDANCE_LABEL[s.attendance!]}</span>; })()}
                </div>
              </div>
              {absent && <p className="mt-3 rounded-lg border border-line bg-inset p-3 text-sm text-muted">Absent: not assessed. This is not recorded as a learning outcome. If the child catches up later, a reassessment can be recorded.</p>}
              {none && <p className="mt-3 rounded-lg border border-line bg-inset p-3 text-sm text-muted">Record attendance first, then assess.</p>}
              {!absent && !none && (
                <div className="mt-4 space-y-4">
                  {shown.map((t) => {
                    const v = cur[key(s.id, t.id)]; const isSaved = v && saved[key(s.id, t.id)] === v;
                    return (
                      <div key={t.id}>
                        <p className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium"><span>{t.name}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">{!v ? 'Not assessed' : isSaved ? <><CheckCircle2 size={12} aria-hidden />Saved</> : <span className="text-gold-light">Unsaved</span>}</span></p>
                        <div role="group" aria-label={`${s.name}: ${t.name}`} className="grid grid-cols-3 gap-2">
                          {OUTCOMES.map((o) => {
                            const { Icon, on } = OUTCOME_META[o]; const sel = v === o;
                            return (
                              <button key={o} type="button" aria-pressed={sel} onClick={() => setCur({ ...cur, [key(s.id, t.id)]: o })}
                                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-lg border px-1 text-center text-xs font-semibold leading-tight transition-colors duration-150 ${sel ? on : 'border-line-strong text-muted hover:border-gold/50 hover:bg-raised hover:text-ink'}`}>
                                <Icon size={18} aria-hidden />{OUTCOME_LABEL[o]}
                              </button>);
                          })}
                        </div>
                      </div>);
                  })}
                  <details className="group"><summary className="inline-flex min-h-[32px] cursor-pointer items-center text-sm text-gold-light underline decoration-gold/40 underline-offset-4">Add a short note</summary>
                    <label className="sr-only" htmlFor={`o-${s.id}`}>Observation for {s.name}</label>
                    <textarea id={`o-${s.id}`} maxLength={500} rows={2} value={obs[s.id] ?? ''} onChange={(e) => setObs({ ...obs, [s.id]: e.target.value })}
                      className={`${input} mt-2 text-sm`} placeholder="Optional, short and relevant to learning" /></details>
                </div>)}
            </li>);
        })}
      </ul>

      <div className="sticky bottom-0 z-30 -mx-4 mt-5 border-t border-line bg-paper/90 px-4 py-3 backdrop-blur-xl sm:bottom-4 sm:mx-0 sm:rounded-card sm:border sm:bg-surface/95">
        {completed && isDirty && (
          <div className="mb-2"><label htmlFor="reason" className="text-sm font-medium">Reason for correction <span className="text-bad">*</span></label>
            <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${input} mt-1`} placeholder="e.g. Tapped the wrong option" /></div>)}
        <p aria-live="polite" className={`mb-2 flex items-center gap-2 text-sm ${msg.kind === 'error' ? 'font-semibold text-bad' : 'text-muted'}`}>
          {msg.kind === 'saving' && <Loader2 size={15} className="animate-spin" aria-hidden />}
          {msg.kind === 'error' && <CircleAlert size={15} aria-hidden />}
          {msg.kind === 'saved' && !isDirty && <CheckCircle2 size={15} className="text-ok" aria-hidden />}
          {stateText}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => save()} disabled={pending || msg.kind === 'saving' || !isDirty} className={btn}>{msg.kind === 'error' ? 'Retry save' : 'Save now'}</button>
          {!completed && <button type="button" onClick={finish} disabled={pending || completion.state === 'not_started'} className={btn2}>Finish assessment</button>}
        </div>
        {!completed && completion.missing.length > 0 && (
          <details className="mt-2 text-sm text-muted"><summary className="cursor-pointer underline decoration-line-strong underline-offset-4">To finish: {completion.missing.length} outcome{completion.missing.length === 1 ? '' : 's'} still needed</summary>
            <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">{completion.missing.slice(0, 12).map((m) => <li key={key(m.studentId, m.topicId)}>{students.find((x) => x.id === m.studentId)?.name}: {topicName[m.topicId]}</li>)}{completion.missing.length > 12 && <li>…and {completion.missing.length - 12} more</li>}</ul></details>)}
      </div>
    </div>
  );
}

'use client';
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleAlert, Loader2 } from 'lucide-react';
import { saveAttendanceAction } from '@/lib/actions/teacher';
import { ATTENDANCE, ATTENDANCE_LABEL, type Attendance } from '@/lib/domain/assessment';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ATTENDANCE_META } from '@/components/status';
import { Progress, btn, btn2 } from '@/components/ui';

type S = { id: string; name: string; code: string };

export function AttendanceBoard({ sessionId, students, initial, locked }: { sessionId: string; students: S[]; initial: Record<string, Attendance>; locked?: boolean }) {
  const [saved, setSaved] = useState<Record<string, Attendance>>(initial);
  const [cur, setCur] = useState<Record<string, Attendance>>(initial);
  const [msg, setMsg] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }>({ kind: 'idle' });
  const [confirmAll, setConfirmAll] = useState(false);
  const [pending, start] = useTransition();
  const dirty = useMemo(() => students.filter((s) => cur[s.id] && cur[s.id] !== saved[s.id]), [students, cur, saved]);
  const recorded = students.filter((s) => saved[s.id]).length;
  const counts = useMemo(() => {
    const c: Record<Attendance, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const s of students) if (cur[s.id]) c[cur[s.id]]++;
    return c;
  }, [students, cur]);

  function setAllPresent() { setCur(Object.fromEntries(students.map((s) => [s.id, 'present' as Attendance]))); }
  function markAll() {
    if (students.some((s) => cur[s.id])) setConfirmAll(true);   // replacing choices already made needs a confirmation
    else setAllPresent();
  }
  function save() {
    const records = dirty.map((s) => ({ student_id: s.id, status: cur[s.id] }));
    setMsg({ kind: 'saving' });
    start(async () => {
      const r = await saveAttendanceAction({ session_id: sessionId, records });
      if (r.ok) { setSaved({ ...saved, ...Object.fromEntries(records.map((x) => [x.student_id, x.status])) }); setMsg({ kind: 'saved', text: `Saved ${r.saved} student${r.saved === 1 ? '' : 's'}.` }); }
      else setMsg({ kind: 'error', text: r.error });          // selections stay on screen for retry
    });
  }

  return (
    <div>
      <div className="panel mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tnum text-sm"><strong className="text-base">{recorded}</strong> <span className="text-muted">of {students.length} recorded</span>{dirty.length > 0 && <span className="text-gold-light"> · {dirty.length} unsaved</span>}</p>
          {!locked && <button type="button" onClick={markAll} className={btn2}>Mark all present</button>}
        </div>
        <div className="mt-3"><Progress value={recorded} max={students.length} label="Attendance recorded" /></div>
        <ul className="tnum mt-3 flex flex-wrap gap-2 text-xs" aria-label="Current selections">
          {ATTENDANCE.map((a) => { const { Icon, chip } = ATTENDANCE_META[a]; return (
            <li key={a} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${counts[a] ? chip : 'border-line text-muted'}`}><Icon size={13} aria-hidden />{ATTENDANCE_LABEL[a]} {counts[a]}</li>); })}
        </ul>
      </div>

      <ul className="space-y-2">
        {students.map((s) => {
          const unsaved = cur[s.id] && cur[s.id] !== saved[s.id];
          return (
            <li key={s.id} className="panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised text-xs font-semibold text-gold-light">{s.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-tight">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted"><span className="font-mono">{s.code}</span>
                    {unsaved ? <span className="text-gold-light">Unsaved</span> : saved[s.id] ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} aria-hidden />Saved</span> : <span>Not recorded</span>}</p>
                </div>
              </div>
              <div role="group" aria-label={`Attendance for ${s.name}`} className="grid grid-cols-4 gap-2 sm:w-[360px] sm:shrink-0">
                {ATTENDANCE.map((a) => {
                  const { Icon, on } = ATTENDANCE_META[a]; const sel = cur[s.id] === a;
                  return (
                    <button key={a} type="button" aria-pressed={sel} disabled={locked} onClick={() => setCur({ ...cur, [s.id]: a })}
                      className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg border px-1 text-xs font-semibold transition-colors duration-150 disabled:opacity-60 ${sel ? on : 'border-line-strong text-muted hover:border-gold/50 hover:bg-raised hover:text-ink'}`}>
                      <Icon size={16} aria-hidden />{ATTENDANCE_LABEL[a]}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 z-30 -mx-4 mt-5 border-t border-line bg-paper/90 px-4 py-3 backdrop-blur-xl sm:bottom-4 sm:mx-0 sm:rounded-card sm:border sm:bg-surface/95">
        <p aria-live="polite" className={`mb-2 flex items-center gap-2 text-sm empty:mb-0 ${msg.kind === 'error' ? 'font-semibold text-bad' : msg.kind === 'saved' ? 'text-ok' : 'text-muted'}`}>
          {msg.kind === 'saving' && <><Loader2 size={15} className="animate-spin" aria-hidden />Saving…</>}
          {msg.kind === 'error' && <><CircleAlert size={15} aria-hidden />{msg.text} Your selections are still here. Try again.</>}
          {msg.kind === 'saved' && dirty.length === 0 && <><CheckCircle2 size={15} aria-hidden />{msg.text}</>}
          {msg.kind !== 'saving' && msg.kind !== 'error' && !(msg.kind === 'saved' && dirty.length === 0) && (dirty.length ? 'Unsaved changes' : '')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={pending || dirty.length === 0 || locked} className={btn}>{msg.kind === 'error' ? 'Retry save' : 'Save attendance'}</button>
          {recorded === students.length && dirty.length === 0 && <Link href={`/teacher/sessions/${sessionId}/assessment`} className={btn2}>Next: assess understanding <ArrowRight size={16} aria-hidden /></Link>}
        </div>
      </div>

      <ConfirmDialog open={confirmAll} title="Set everyone to Present?" body="This replaces the choices you have already made for this session. You can still change any student afterwards, and nothing is saved until you save attendance."
        confirmLabel="Set all to Present" onCancel={() => setConfirmAll(false)} onConfirm={() => { setAllPresent(); setConfirmAll(false); }} />
    </div>
  );
}

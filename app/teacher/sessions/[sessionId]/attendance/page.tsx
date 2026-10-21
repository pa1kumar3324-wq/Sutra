import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Flash } from '@/components/ui';
import { AttendanceBoard } from '@/components/attendance/AttendanceBoard';
import { fmtDate, requireTeacher } from '@/lib/auth/session';
import { loadSession } from '@/lib/session-data';

export const metadata: Metadata = { title: 'Attendance' };

export default async function AttendancePage({ params, searchParams }: { params: { sessionId: string }; searchParams: { ok?: string } }) {
  const ctx = await requireTeacher();
  const { session, students } = await loadSession(ctx, params.sessionId);
  const initial = Object.fromEntries(students.filter((s) => s.attendance).map((s) => [s.id, s.attendance!]));
  return (
    <>
      <PageHeader title="Attendance" sub={<>{session.classes?.name} · {session.subjects?.name} · {fmtDate(session.session_date)} · <Link className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href={`/teacher/sessions/${params.sessionId}`}>Session</Link></>} />
      <Flash ok={searchParams.ok} />
      {students.length === 0 ? <p className="panel p-4 text-sm text-muted">No students were enrolled in this class on this date.</p> :
        <AttendanceBoard sessionId={params.sessionId} students={students.map(({ id, name, code }) => ({ id, name, code }))} initial={initial} />}
    </>
  );
}

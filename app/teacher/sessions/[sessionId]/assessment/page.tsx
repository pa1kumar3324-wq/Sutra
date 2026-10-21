import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Empty } from '@/components/ui';
import { AssessmentBoard } from '@/components/assessment/AssessmentBoard';
import { fmtDate, requireTeacher } from '@/lib/auth/session';
import { loadSession } from '@/lib/session-data';

export const metadata: Metadata = { title: 'Assess understanding' };

export default async function AssessmentPage({ params }: { params: { sessionId: string } }) {
  const ctx = await requireTeacher();
  const { session, students, topics, results, assessmentStatus } = await loadSession(ctx, params.sessionId);
  return (
    <>
      <PageHeader title="How did the class understand?" sub={<>{session.classes?.name} · {session.subjects?.name} · {fmtDate(session.session_date)} · <Link className="text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href={`/teacher/sessions/${params.sessionId}`}>Session</Link></>} />
      {topics.length === 0 ? <Empty title="Choose the topics taught first" action={<Link className="font-semibold text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href={`/teacher/sessions/${params.sessionId}`}>Select topics</Link>} /> :
        students.length === 0 ? <Empty title="No students on the roster for this date" /> :
        <AssessmentBoard sessionId={params.sessionId} status={assessmentStatus} topics={topics} students={students} initial={results} />}
    </>
  );
}

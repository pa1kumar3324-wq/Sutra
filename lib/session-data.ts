import 'server-only';
import { notFound } from 'next/navigation';
import type { Ctx } from '@/lib/auth/session';
import type { Attendance, Outcome } from '@/lib/domain/assessment';

/** Loads a session through RLS: a teacher who doesn't own it simply gets "not found". */
export async function loadSession(ctx: Ctx, sessionId: string) {
  const sb = ctx.supabase;
  const { data: s } = await sb.from('class_sessions')
    .select('id, session_date, status, lesson_notes, class_id, subject_id, classes(name), subjects(name), assessments(status)')
    .eq('id', sessionId).eq('organization_id', ctx.orgId).maybeSingle();
  if (!s) notFound();
  const session = s as any;
  const date: string = session.session_date;
  const [topics, roster, att, res] = await Promise.all([
    sb.from('session_topics').select('topic_id, topics(id, name)').eq('class_session_id', sessionId),
    sb.from('enrollments').select('students(id, full_name, student_code)').eq('class_id', session.class_id)
      .lte('start_date', date).or(`end_date.is.null,end_date.gte.${date}`),
    sb.from('attendance_records').select('student_id, status').eq('class_session_id', sessionId),
    sb.from('assessment_results').select('student_id, topic_id, outcome').eq('class_session_id', sessionId),
  ]);
  const attMap = new Map(((att.data ?? []) as any[]).map((r) => [r.student_id, r.status as Attendance]));
  const students = ((roster.data ?? []) as any[]).map((e) => e.students).filter(Boolean)
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name))
    .map((st: any) => ({ id: st.id as string, name: st.full_name as string, code: st.student_code as string, attendance: attMap.get(st.id) ?? null }));
  const topicList = ((topics.data ?? []) as any[]).map((t) => ({ id: t.topics.id as string, name: t.topics.name as string })).sort((a, b) => a.name.localeCompare(b.name));
  const results: Record<string, Outcome> = {};
  for (const r of (res.data ?? []) as any[]) results[`${r.student_id}|${r.topic_id}`] = r.outcome;
  const asmt = (Array.isArray(session.assessments) ? session.assessments[0]?.status : session.assessments?.status) ?? 'pending';
  return { session, students, topics: topicList, results, assessmentStatus: asmt as 'pending' | 'in_progress' | 'completed' };
}

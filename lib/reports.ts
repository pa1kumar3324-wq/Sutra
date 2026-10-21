import 'server-only';
import type { Ctx } from '@/lib/auth/session';
import type { Attendance, Outcome } from '@/lib/domain/assessment';

export type Filters = { from: string; to: string; class_id?: string; subject_id?: string; teacher_id?: string; outcome?: Outcome };
export const ROW_CAP = 20000;

export type AttendanceRow = { student_id: string; student: string; code: string; class_id: string; class: string; subject: string; teacher: string; date: string; status: Attendance };
export type ResultRow = { student_id: string; student: string; code: string; class_id: string; class: string; subject_id: string; subject: string; topic_id: string; topic: string; teacher: string; date: string; outcome: Outcome };

/* All queries run as the signed-in user, so RLS limits rows (a teacher only ever gets their own sessions)
   and the explicit organization_id filter is defence in depth. Date ranges are bounded by the caller's schema. */

export async function fetchAttendance(ctx: Ctx, f: Filters): Promise<AttendanceRow[]> {
  let q = ctx.supabase.from('attendance_records')
    .select('student_id, status, students(full_name, student_code), class_sessions!inner(session_date, class_id, subject_id, teacher_user_id, classes(name), subjects(name), profiles(display_name))')
    .eq('organization_id', ctx.orgId)
    .gte('class_sessions.session_date', f.from).lte('class_sessions.session_date', f.to).limit(ROW_CAP);
  if (f.class_id) q = q.eq('class_sessions.class_id', f.class_id);
  if (f.subject_id) q = q.eq('class_sessions.subject_id', f.subject_id);
  if (f.teacher_id) q = q.eq('class_sessions.teacher_user_id', f.teacher_id);
  const { data, error } = await q;
  if (error) throw new Error('Could not load attendance');
  return ((data ?? []) as any[]).map((r) => ({
    student_id: r.student_id, student: r.students?.full_name ?? '', code: r.students?.student_code ?? '', class_id: r.class_sessions.class_id,
    class: r.class_sessions.classes?.name ?? '', subject: r.class_sessions.subjects?.name ?? '', teacher: r.class_sessions.profiles?.display_name ?? '',
    date: r.class_sessions.session_date, status: r.status,
  }));
}

export async function fetchResults(ctx: Ctx, f: Filters): Promise<ResultRow[]> {
  let q = ctx.supabase.from('assessment_results')
    .select('student_id, topic_id, outcome, students(full_name, student_code), topics(name, subject_id), class_sessions!inner(session_date, class_id, subject_id, teacher_user_id, classes(name), subjects(name), profiles(display_name))')
    .eq('organization_id', ctx.orgId)
    .gte('class_sessions.session_date', f.from).lte('class_sessions.session_date', f.to).limit(ROW_CAP);
  if (f.class_id) q = q.eq('class_sessions.class_id', f.class_id);
  if (f.subject_id) q = q.eq('class_sessions.subject_id', f.subject_id);
  if (f.teacher_id) q = q.eq('class_sessions.teacher_user_id', f.teacher_id);
  if (f.outcome) q = q.eq('outcome', f.outcome);
  const { data, error } = await q;
  if (error) throw new Error('Could not load assessments');
  return ((data ?? []) as any[]).map((r) => ({
    student_id: r.student_id, student: r.students?.full_name ?? '', code: r.students?.student_code ?? '', class_id: r.class_sessions.class_id,
    class: r.class_sessions.classes?.name ?? '', subject_id: r.topics?.subject_id ?? '', subject: r.class_sessions.subjects?.name ?? '',
    topic_id: r.topic_id, topic: r.topics?.name ?? '', teacher: r.class_sessions.profiles?.display_name ?? '',
    date: r.class_sessions.session_date, outcome: r.outcome,
  }));
}

export async function fetchCompletion(ctx: Ctx, f: Filters) {
  let q = ctx.supabase.from('class_sessions').select('id, assessments(status)').eq('organization_id', ctx.orgId)
    .gte('session_date', f.from).lte('session_date', f.to).limit(ROW_CAP);
  if (f.class_id) q = q.eq('class_id', f.class_id);
  if (f.subject_id) q = q.eq('subject_id', f.subject_id);
  if (f.teacher_id) q = q.eq('teacher_user_id', f.teacher_id);
  const { data } = await q;
  const rows = (data ?? []) as any[];
  const status = (r: any) => (Array.isArray(r.assessments) ? r.assessments[0]?.status : r.assessments?.status) ?? 'pending';
  return { sessions: rows.length, completed: rows.filter((r) => status(r) === 'completed').length };
}

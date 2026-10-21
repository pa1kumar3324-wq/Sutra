'use server';
import { z } from 'zod';
import { requireContext } from '@/lib/auth/session';
import { assessmentSaveSchema, attendanceSchema, sessionCreateSchema, topicSchema } from '@/lib/validations/schemas';
import { dbMessage, flash, formObject } from './helpers';

export type SaveResult = { ok: true; saved: number } | { ok: false; error: string };

export async function createSession(fd: FormData) {
  const ctx = await requireContext();
  const raw = formObject(fd);
  const base = `/teacher/classes/${raw.class_id ?? ''}/sessions/new`;
  const p = sessionCreateSchema.safeParse({ ...raw, topic_ids: fd.getAll('topic_ids').map(String) });
  if (!p.success) flash(base, 'error', p.error.issues[0].message);
  const { data, error } = await ctx.supabase.rpc('create_class_session', {
    p_assignment_id: p.data!.assignment_id, p_session_date: p.data!.session_date, p_request_key: p.data!.request_key,
    p_topic_ids: p.data!.topic_ids, p_notes: p.data!.notes ?? '',
  });
  if (error) flash(base, 'error', dbMessage(error));
  flash(`/teacher/sessions/${data}/attendance`, 'ok', 'Session started. Record attendance next.');
}

export async function updateSessionTopics(fd: FormData) {
  const ctx = await requireContext();
  const id = z.string().uuid().parse(fd.get('session_id'));
  const topicIds = z.array(z.string().uuid()).min(1, 'Select at least one topic').safeParse(fd.getAll('topic_ids').map(String));
  const path = `/teacher/sessions/${id}`;
  if (!topicIds.success) flash(path, 'error', topicIds.error.issues[0].message);
  const { error } = await ctx.supabase.rpc('set_session_topics', { p_session_id: id, p_topic_ids: topicIds.data!, p_notes: String(fd.get('notes') ?? '').slice(0, 2000) });
  if (error) flash(path, 'error', dbMessage(error));
  flash(path, 'ok', 'Topics updated.');
}

export async function addTopic(fd: FormData) {
  const ctx = await requireContext();
  const raw = formObject(fd);
  const path = `/teacher/sessions/${raw.session_id}`;
  const p = topicSchema.safeParse({ name: raw.name, subject_id: raw.subject_id });
  if (!p.success) flash(path, 'error', p.error.issues[0].message);
  const { error } = await ctx.supabase.from('topics').insert({ ...p.data!, organization_id: ctx.orgId });
  if (error) flash(path, 'error', error.code === '23505' ? 'That topic already exists.' : dbMessage(error));
  flash(path, 'ok', 'Topic added. Tick it below to include it.');
}

/** Called from the client board. Returns only after the database confirms. */
export async function saveAttendanceAction(input: unknown): Promise<SaveResult> {
  const ctx = await requireContext();
  const p = attendanceSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Invalid attendance data.' };
  const { data, error } = await ctx.supabase.rpc('save_attendance', { p_session_id: p.data.session_id, p_records: p.data.records });
  if (error) return { ok: false, error: dbMessage(error) };
  return { ok: true, saved: Number(data) };
}

export async function saveAssessmentAction(input: unknown): Promise<SaveResult> {
  const ctx = await requireContext();
  const p = assessmentSaveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: 'Invalid assessment data.' };
  const { session_id, results, observations, reason } = p.data;
  if (results.length > 0) {
    const { error } = await ctx.supabase.rpc('save_assessment_results', { p_session_id: session_id, p_results: results, p_reason: reason });
    if (error) return { ok: false, error: dbMessage(error) };
  }
  if (observations.length > 0) {
    const { error } = await ctx.supabase.from('learning_observations').insert(
      observations.map((o) => ({ organization_id: ctx.orgId, student_id: o.student_id, class_session_id: session_id, author_user_id: ctx.userId, observation: o.observation })));
    if (error) return { ok: false, error: 'Outcomes saved, but a note could not be saved: ' + dbMessage(error) };
  }
  return { ok: true, saved: results.length };
}

export async function completeAssessmentAction(sessionId: string): Promise<SaveResult> {
  const ctx = await requireContext();
  const id = z.string().uuid().safeParse(sessionId);
  if (!id.success) return { ok: false, error: 'Invalid session.' };
  const { error } = await ctx.supabase.rpc('complete_assessment', { p_session_id: id.data });
  if (error) return { ok: false, error: dbMessage(error) };
  return { ok: true, saved: 0 };
}

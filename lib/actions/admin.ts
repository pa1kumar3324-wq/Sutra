'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { assignmentSchema, classSchema, inviteSchema, settingsSchema, studentSchema, subjectSchema, topicSchema, yearSchema } from '@/lib/validations/schemas';
import { dbMessage, flash, formObject, zodMessage } from './helpers';

const uuid = z.string().uuid();
const back = (fd: FormData, fallback: string) => {
  const r = String(fd.get('_return') ?? '');
  return r.startsWith('/admin/') ? r.split('?')[0] : fallback;
};

export async function createStudent(fd: FormData) {
  const ctx = await requireAdmin();
  const p = studentSchema.safeParse(formObject(fd));
  if (!p.success) flash('/admin/students/new', 'error', zodMessage(p.error));
  const { class_id, ...s } = p.data!;
  const { data, error } = await ctx.supabase.from('students').insert({ ...s, organization_id: ctx.orgId }).select('id').single();
  if (error) flash('/admin/students/new', 'error', error.code === '23505' ? 'That student code is already in use.' : dbMessage(error));
  if (class_id) {
    const { data: cls } = await ctx.supabase.from('classes').select('academic_year_id').eq('id', class_id).single();
    if (!cls) flash(`/admin/students/${data!.id}`, 'error', 'Student saved, but the class was not found.');
    const { error: e2 } = await ctx.supabase.from('enrollments').insert({ organization_id: ctx.orgId, student_id: data!.id, class_id, academic_year_id: cls!.academic_year_id });
    if (e2) flash(`/admin/students/${data!.id}`, 'error', 'Student saved, but enrolment failed: ' + dbMessage(e2));
  }
  revalidatePath('/admin/students');
  flash(`/admin/students/${data!.id}`, 'ok', 'Student registered.');
}

export async function setStudentStatus(fd: FormData) {
  const ctx = await requireAdmin();
  const v = formObject(fd);
  const id = uuid.parse(v.student_id);
  const status = z.enum(['active', 'inactive', 'graduated', 'withdrawn']).parse(v.status);
  const path = `/admin/students/${id}`;
  const { error } = await ctx.supabase.from('students').update({ enrollment_status: status, left_at: ['graduated', 'withdrawn'].includes(status) ? new Date().toISOString().slice(0, 10) : null }).eq('id', id);
  if (error) flash(path, 'error', dbMessage(error));
  if (status !== 'active') {            // end active enrolments but keep all history
    await ctx.supabase.from('enrollments').update({ status: status === 'graduated' ? 'completed' : 'withdrawn', end_date: new Date().toISOString().slice(0, 10) }).eq('student_id', id).eq('status', 'active');
  }
  flash(path, 'ok', 'Student status updated.');
}

export async function enrollStudent(fd: FormData) {
  const ctx = await requireAdmin();
  const v = formObject(fd);
  const studentId = uuid.parse(v.student_id); const classId = uuid.safeParse(v.class_id);
  const path = `/admin/students/${studentId}`;
  if (!classId.success) flash(path, 'error', 'Choose a class.');
  const { data: cls } = await ctx.supabase.from('classes').select('academic_year_id').eq('id', classId.data!).single();
  if (!cls) flash(path, 'error', 'Class not found.');
  const { error } = await ctx.supabase.from('enrollments').insert({ organization_id: ctx.orgId, student_id: studentId, class_id: classId.data!, academic_year_id: cls!.academic_year_id });
  if (error) flash(path, 'error', error.code === '23505' ? 'This student already has an active enrolment in that class or academic year. Use transfer instead.' : dbMessage(error));
  flash(path, 'ok', 'Student enrolled.');
}

export async function transferStudent(fd: FormData) {
  const ctx = await requireAdmin();
  const v = formObject(fd);
  const enrollmentId = uuid.parse(v.enrollment_id); const classId = uuid.safeParse(v.class_id); const studentId = uuid.parse(v.student_id);
  const path = `/admin/students/${studentId}`;
  if (!classId.success) flash(path, 'error', 'Choose a class to transfer to.');
  const { error } = await ctx.supabase.rpc('transfer_enrollment', { p_enrollment_id: enrollmentId, p_new_class_id: classId.data!, p_date: new Date().toISOString().slice(0, 10) });
  if (error) flash(path, 'error', error.code === '23505' ? 'The student is already active in that class or year.' : dbMessage(error));
  flash(path, 'ok', 'Student transferred. Earlier records stay with the previous class.');
}

export async function endEnrollment(fd: FormData) {
  const ctx = await requireAdmin();
  const v = formObject(fd);
  const id = uuid.parse(v.enrollment_id); const studentId = uuid.parse(v.student_id);
  const { error } = await ctx.supabase.from('enrollments').update({ status: 'completed', end_date: new Date().toISOString().slice(0, 10) }).eq('id', id).eq('status', 'active');
  if (error) flash(`/admin/students/${studentId}`, 'error', dbMessage(error));
  flash(`/admin/students/${studentId}`, 'ok', 'Enrolment ended.');
}

export async function createClass(fd: FormData) {
  const ctx = await requireAdmin();
  const p = classSchema.safeParse(formObject(fd));
  if (!p.success) flash('/admin/classes', 'error', zodMessage(p.error));
  const { error } = await ctx.supabase.from('classes').insert({ ...p.data!, organization_id: ctx.orgId });
  if (error) flash('/admin/classes', 'error', error.code === '23505' ? 'A class with that name already exists in this academic year.' : dbMessage(error));
  flash('/admin/classes', 'ok', 'Class created.');
}
export async function setClassStatus(fd: FormData) {
  const ctx = await requireAdmin();
  const v = formObject(fd); const id = uuid.parse(v.class_id);
  const status = z.enum(['active', 'archived']).parse(v.status);
  const { error } = await ctx.supabase.from('classes').update({ status }).eq('id', id);
  if (error) flash(`/admin/classes/${id}`, 'error', dbMessage(error));
  flash(`/admin/classes/${id}`, 'ok', status === 'archived' ? 'Class archived. All history is kept.' : 'Class restored.');
}

export async function createSubject(fd: FormData) {
  const ctx = await requireAdmin();
  const p = subjectSchema.safeParse(formObject(fd));
  if (!p.success) flash('/admin/subjects', 'error', zodMessage(p.error));
  const { error } = await ctx.supabase.from('subjects').insert({ ...p.data!, organization_id: ctx.orgId });
  if (error) flash('/admin/subjects', 'error', error.code === '23505' ? 'That subject already exists.' : dbMessage(error));
  flash('/admin/subjects', 'ok', 'Subject created.');
}
export async function createTopic(fd: FormData) {
  const ctx = await requireAdmin();
  const p = topicSchema.safeParse(formObject(fd));
  if (!p.success) flash('/admin/topics', 'error', zodMessage(p.error));
  const { error } = await ctx.supabase.from('topics').insert({ ...p.data!, organization_id: ctx.orgId });
  if (error) flash('/admin/topics', 'error', error.code === '23505' ? 'That topic already exists for the subject.' : dbMessage(error));
  flash('/admin/topics', 'ok', 'Topic added.');
}
export async function setTopicStatus(fd: FormData) {
  const ctx = await requireAdmin();
  const v = formObject(fd);
  const { error } = await ctx.supabase.from('topics').update({ status: z.enum(['active', 'archived']).parse(v.status) }).eq('id', uuid.parse(v.topic_id));
  if (error) flash('/admin/topics', 'error', dbMessage(error));
  flash('/admin/topics', 'ok', 'Topic updated.');
}

export async function createYear(fd: FormData) {
  const ctx = await requireAdmin();
  const p = yearSchema.safeParse(formObject(fd));
  if (!p.success) flash('/admin/academic-years', 'error', zodMessage(p.error));
  const { error } = await ctx.supabase.from('academic_years').insert({ ...p.data!, organization_id: ctx.orgId, status: 'active' });
  if (error) flash('/admin/academic-years', 'error', error.code === '23505' ? 'An academic year with that name exists.' : dbMessage(error));
  flash('/admin/academic-years', 'ok', 'Academic year created.');
}
export async function setYearStatus(fd: FormData) {
  const ctx = await requireAdmin();
  const v = formObject(fd);
  const { error } = await ctx.supabase.from('academic_years').update({ status: z.enum(['planned', 'active', 'closed']).parse(v.status) }).eq('id', uuid.parse(v.year_id));
  if (error) flash('/admin/academic-years', 'error', dbMessage(error));
  flash('/admin/academic-years', 'ok', 'Academic year updated.');
}

export async function createAssignment(fd: FormData) {
  const ctx = await requireAdmin();
  const p = assignmentSchema.safeParse(formObject(fd));
  if (!p.success) flash('/admin/assignments', 'error', 'Choose a class, a subject and a teacher.');
  const { data: cls } = await ctx.supabase.from('classes').select('academic_year_id').eq('id', p.data!.class_id).single();
  if (!cls) flash('/admin/assignments', 'error', 'Class not found.');
  const { error } = await ctx.supabase.from('teaching_assignments').insert({ ...p.data!, organization_id: ctx.orgId, academic_year_id: cls!.academic_year_id });
  if (error) flash('/admin/assignments', 'error', error.code === '23505' ? 'That teacher already teaches this subject in this class.' : dbMessage(error));
  flash('/admin/assignments', 'ok', 'Teaching assignment created.');
}
export async function endAssignment(fd: FormData) {
  const ctx = await requireAdmin();
  const { error } = await ctx.supabase.from('teaching_assignments').update({ status: 'archived', end_date: new Date().toISOString().slice(0, 10) }).eq('id', uuid.parse(formObject(fd).assignment_id));
  if (error) flash('/admin/assignments', 'error', dbMessage(error));
  flash('/admin/assignments', 'ok', 'Assignment ended. Past sessions are kept.');
}

/** Invite staff. Service role is used ONLY for Auth Admin + membership creation, after requireAdmin(). */
export async function inviteStaff(fd: FormData) {
  const ctx = await requireAdmin();
  const v = formObject(fd);
  const p = inviteSchema.safeParse(v);
  if (!p.success) flash('/admin/teachers', 'error', zodMessage(p.error));
  const role = v.role === 'admin' ? 'admin' : 'teacher';
  if (role === 'admin' && ctx.role !== 'owner') flash('/admin/teachers', 'error', 'Only the trust owner can invite administrators.');
  const admin = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const { data: existing } = await admin.from('profiles').select('id').eq('email', p.data!.email).maybeSingle();
  let userId = existing?.id as string | undefined; let status: 'invited' | 'active' = 'active';
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(p.data!.email, { redirectTo: `${site}/auth/callback?next=/accept-invitation`, data: { display_name: p.data!.display_name } });
    if (error || !data.user) flash('/admin/teachers', 'error', 'Could not send the invitation. Check the email address and try again.');
    userId = data!.user!.id; status = 'invited';
  }
  const { error } = await admin.from('organization_memberships').insert({ organization_id: ctx.orgId, user_id: userId!, role, status });
  if (error) flash('/admin/teachers', 'error', error.code === '23505' ? 'That person is already a member.' : 'Could not add the member.');
  await admin.from('audit_logs').insert({ organization_id: ctx.orgId, actor_user_id: ctx.userId, action: 'invite', entity_type: 'organization_memberships', metadata: { role } });
  flash('/admin/teachers', 'ok', status === 'invited' ? 'Invitation sent.' : 'Existing account added to your trust.');
}
export async function setMemberStatus(fd: FormData) {
  const ctx = await requireAdmin();
  const v = formObject(fd);
  const status = z.enum(['active', 'deactivated']).parse(v.status);
  const { error } = await ctx.supabase.from('organization_memberships').update({ status }).eq('id', uuid.parse(v.membership_id)).eq('organization_id', ctx.orgId);
  if (error) flash('/admin/teachers', 'error', dbMessage(error));
  flash('/admin/teachers', 'ok', status === 'deactivated' ? 'Access revoked immediately.' : 'Access restored.');
}

export async function updateSettings(fd: FormData) {
  const ctx = await requireAdmin();
  const p = settingsSchema.safeParse(formObject(fd));
  if (!p.success) flash('/admin/settings', 'error', zodMessage(p.error));
  const { error } = await ctx.supabase.from('organizations').update(p.data!).eq('id', ctx.orgId);
  if (error) flash('/admin/settings', 'error', dbMessage(error));
  flash('/admin/settings', 'ok', 'Settings saved.');
}

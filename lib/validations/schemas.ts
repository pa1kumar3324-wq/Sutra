import { z } from 'zod';
import { ATTENDANCE, OUTCOMES } from '@/lib/domain/assessment';

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).optional().transform((v) => (v ? v : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').refine((d) => !Number.isNaN(Date.parse(d)), 'Use a valid date');

export const studentSchema = z.object({
  full_name: text(120).min(1, 'Name is required'),
  student_code: text(40).min(1, 'Student code is required').regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, . _ - only'),
  current_school_grade: text(40).min(1, 'Grade is required'),
  date_of_birth: optText(10).refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Use a valid date'),
  school_name: optText(120),
  class_id: uuid.optional().or(z.literal('').transform(() => undefined)),
});
export const classSchema = z.object({
  name: text(80).min(1, 'Name is required'), grade_level: text(40).min(1, 'Grade is required'),
  section: optText(20), description: optText(300), academic_year_id: uuid,
});
export const subjectSchema = z.object({ name: text(80).min(1, 'Name is required'), description: optText(300) });
export const topicSchema = z.object({ name: text(120).min(1, 'Name is required'), subject_id: uuid, description: optText(300) });
export const yearSchema = z.object({ name: text(40).min(1), start_date: date, end_date: date })
  .refine((v) => v.end_date > v.start_date, { message: 'End date must be after start date', path: ['end_date'] });
export const assignmentSchema = z.object({ class_id: uuid, subject_id: uuid, teacher_user_id: uuid });
export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'), display_name: text(100).min(1, 'Name is required'),
});
export const sessionCreateSchema = z.object({
  assignment_id: uuid, session_date: date, request_key: text(64).min(8),
  topic_ids: z.array(uuid).min(1, 'Select at least one topic'), notes: optText(2000),
});
export const attendanceSchema = z.object({
  session_id: uuid,
  records: z.array(z.object({ student_id: uuid, status: z.enum(ATTENDANCE) })).min(1).max(500),
});
export const assessmentSaveSchema = z.object({
  session_id: uuid,
  results: z.array(z.object({ student_id: uuid, topic_id: uuid, outcome: z.enum(OUTCOMES) })).max(2000),
  observations: z.array(z.object({ student_id: uuid, observation: text(500).min(1) })).max(500).default([]),
  reason: optText(300),
});
export const settingsSchema = z.object({
  name: text(120).min(1), contact_email: z.string().trim().email().or(z.literal('')).optional().transform((v) => v || null),
  timezone: text(60).min(1).refine((tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'Unknown timezone'),
});
export const reportFilterSchema = z.object({
  from: date, to: date, class_id: uuid.optional(), subject_id: uuid.optional(), teacher_id: uuid.optional(),
  outcome: z.enum(OUTCOMES).optional(),
}).refine((v) => v.to >= v.from, 'End date must not be before start date')
  .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 366, 'Date range is limited to one year');

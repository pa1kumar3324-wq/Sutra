export const OUTCOMES = ['understood', 'needs_revision', 'didnt_understand'] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  understood: 'Understood',
  needs_revision: 'Needs Revision',
  didnt_understand: "Didn't Understand",
};
export const ATTENDANCE = ['present', 'absent', 'late', 'excused'] as const;
export type Attendance = (typeof ATTENDANCE)[number];
export const ATTENDANCE_LABEL: Record<Attendance, string> = {
  present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused',
};
export const isOutcome = (v: unknown): v is Outcome => OUTCOMES.includes(v as Outcome);
export const isAttendance = (v: unknown): v is Attendance => ATTENDANCE.includes(v as Attendance);

/** Absent students are never assessed. Late/excused/present students may be. */
export const canAssess = (a: Attendance | null | undefined) => a != null && a !== 'absent';

export type CompletionInput = {
  students: { id: string; attendance: Attendance | null }[];
  topicIds: string[];
  results: { studentId: string; topicId: string }[];
};
export type Completion = {
  state: 'not_started' | 'in_progress' | 'completed';
  attendanceMissing: string[];
  missing: { studentId: string; topicId: string }[];
  required: number;
  done: number;
};
/** Every enrolled student has attendance, and every non-absent student has an outcome for every
 *  topic. Missing data is never converted into an outcome. */
export function assessmentCompletion(i: CompletionInput): Completion {
  const have = new Set(i.results.map((r) => `${r.studentId}|${r.topicId}`));
  const missing: Completion['missing'] = [];
  let required = 0;
  for (const s of i.students) {
    if (!canAssess(s.attendance)) continue;
    for (const t of i.topicIds) {
      required++;
      if (!have.has(`${s.id}|${t}`)) missing.push({ studentId: s.id, topicId: t });
    }
  }
  const attendanceMissing = i.students.filter((s) => s.attendance == null).map((s) => s.id);
  const done = required - missing.length;
  const complete = i.topicIds.length > 0 && attendanceMissing.length === 0 && missing.length === 0;
  return { state: complete ? 'completed' : done > 0 ? 'in_progress' : 'not_started', attendanceMissing, missing, required, done };
}

export type SessionStatus = 'draft' | 'in_progress' | 'completed';
const NEXT: Record<SessionStatus, SessionStatus[]> = { draft: ['in_progress'], in_progress: ['completed'], completed: [] };
export const canTransitionSession = (from: SessionStatus, to: SessionStatus) => from === to || NEXT[from].includes(to);

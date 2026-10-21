import { describe, expect, it } from 'vitest';
import { assessmentCompletion, canAssess, canTransitionSession, isOutcome, OUTCOMES } from '@/lib/domain/assessment';
import { attendanceSummary, recentAbsenceStreak } from '@/lib/domain/attendance';
import { distribution, strugglingTopics, topicStatus, statusesByStudentTopic } from '@/lib/domain/progress';
import { csvCell, toCsv } from '@/lib/domain/csv';
import { assessmentSaveSchema, reportFilterSchema, studentSchema, yearSchema } from '@/lib/validations/schemas';

const today = new Date('2026-10-20');
const u = '11111111-1111-4111-8111-111111111111';

describe('assessment outcomes', () => {
  it('has exactly the three canonical values', () => {
    expect([...OUTCOMES]).toEqual(['understood', 'needs_revision', 'didnt_understand']);
    expect(isOutcome('great')).toBe(false);
    expect(isOutcome('understood')).toBe(true);
  });
  it('absent students cannot be assessed; unrecorded attendance cannot either', () => {
    expect(canAssess('absent')).toBe(false);
    expect(canAssess(null)).toBe(false);
    expect(['present', 'late', 'excused'].every((s) => canAssess(s as any))).toBe(true);
  });
  it('rejects bad outcomes in the save schema', () => {
    expect(assessmentSaveSchema.safeParse({ session_id: u, results: [{ student_id: u, topic_id: u, outcome: 'ok' }] }).success).toBe(false);
    expect(assessmentSaveSchema.safeParse({ session_id: u, results: [{ student_id: u, topic_id: u, outcome: 'needs_revision' }] }).success).toBe(true);
  });
});

describe('assessment completion', () => {
  const students = [{ id: 'a', attendance: 'present' as const }, { id: 'b', attendance: 'absent' as const }, { id: 'c', attendance: 'late' as const }];
  it('not started', () => {
    expect(assessmentCompletion({ students, topicIds: ['t1', 't2'], results: [] }).state).toBe('not_started');
  });
  it('absent students are not required; missing topics are explicit', () => {
    const c = assessmentCompletion({ students, topicIds: ['t1', 't2'], results: [{ studentId: 'a', topicId: 't1' }, { studentId: 'a', topicId: 't2' }, { studentId: 'c', topicId: 't1' }] });
    expect(c.required).toBe(4);
    expect(c.missing).toEqual([{ studentId: 'c', topicId: 't2' }]);
    expect(c.state).toBe('in_progress');
  });
  it('completed only when all present students have all topics and attendance is complete', () => {
    const results = ['a', 'c'].flatMap((s) => ['t1', 't2'].map((t) => ({ studentId: s, topicId: t })));
    expect(assessmentCompletion({ students, topicIds: ['t1', 't2'], results }).state).toBe('completed');
    expect(assessmentCompletion({ students: [...students, { id: 'd', attendance: null }], topicIds: ['t1', 't2'], results }).state).toBe('in_progress');
  });
});

describe('session lifecycle', () => {
  it('only moves forward', () => {
    expect(canTransitionSession('draft', 'in_progress')).toBe(true);
    expect(canTransitionSession('in_progress', 'completed')).toBe(true);
    expect(canTransitionSession('completed', 'draft')).toBe(false);
  });
});

describe('attendance', () => {
  it('excludes excused and unrecorded from the denominator', () => {
    const s = attendanceSummary(['present', 'late', 'absent', 'excused']);
    expect(s.eligible).toBe(3);
    expect(s.percentage).toBe(66.7);
  });
  it('returns null (not 0%) when nothing is eligible', () => {
    expect(attendanceSummary([]).percentage).toBeNull();
    expect(attendanceSummary(['excused']).percentage).toBeNull();
  });
  it('counts consecutive absences, skipping excused', () => {
    expect(recentAbsenceStreak(['present', 'absent', 'excused', 'absent'])).toBe(2);
    expect(recentAbsenceStreak(['absent', 'present'])).toBe(0);
  });
});

describe('progress & revision rules', () => {
  it('the fractions example: history improves and is preserved', () => {
    const h = [
      { date: '2026-10-05', outcome: 'didnt_understand' as const },
      { date: '2026-10-12', outcome: 'needs_revision' as const },
      { date: '2026-10-19', outcome: 'understood' as const },
    ];
    const s = topicStatus(h, today)!;
    expect(s.current).toBe('understood');
    expect(s.flags).toContain('improved');
    expect(s.flags).not.toContain('follow_up');
    expect(s.attempts).toBe(3);
  });
  it('latest didnt_understand => follow_up; needs_revision => revision', () => {
    expect(topicStatus([{ date: '2026-10-19', outcome: 'didnt_understand' }], today)!.flags).toContain('follow_up');
    expect(topicStatus([{ date: '2026-10-19', outcome: 'needs_revision' }], today)!.flags).toContain('revision');
  });
  it('repeated difficulty needs 2 of last 3 not understood and latest not understood', () => {
    const h = [{ date: '2026-10-01', outcome: 'needs_revision' as const }, { date: '2026-10-10', outcome: 'didnt_understand' as const }];
    expect(topicStatus(h, today)!.flags).toContain('repeated_difficulty');
  });
  it('flags stale topics and handles no history', () => {
    expect(topicStatus([{ date: '2026-08-01', outcome: 'understood' }], today)!.flags).toContain('stale');
    expect(topicStatus([], today)).toBeNull();
  });
  it('sorts unordered history by date', () => {
    const s = topicStatus([{ date: '2026-10-19', outcome: 'understood' }, { date: '2026-10-05', outcome: 'didnt_understand' }], today)!;
    expect(s.current).toBe('understood');
  });
  it('distribution reports counts, no score', () => {
    expect(distribution(['understood', 'understood', 'needs_revision'])).toEqual({ understood: 2, needs_revision: 1, didnt_understand: 0, total: 3 });
  });
  it('finds topics where many students currently struggle', () => {
    const rows = [
      { studentId: 's1', topicId: 'dec', date: '2026-10-10', outcome: 'didnt_understand' as const },
      { studentId: 's2', topicId: 'dec', date: '2026-10-10', outcome: 'needs_revision' as const },
      { studentId: 's3', topicId: 'dec', date: '2026-10-10', outcome: 'understood' as const },
      { studentId: 's1', topicId: 'fr', date: '2026-10-10', outcome: 'understood' as const },
    ];
    const r = strugglingTopics(statusesByStudentTopic(rows, today));
    expect(r).toEqual([{ topicId: 'dec', assessed: 3, struggling: 2 }]);
  });
});

describe('csv', () => {
  it('neutralises formula injection and quotes', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM')).toBe("'@SUM");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(null)).toBe('');
  });
  it('builds rows', () => { expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n'); });
});

describe('validation', () => {
  it('student schema', () => {
    expect(studentSchema.safeParse({ full_name: '', student_code: 'a b', current_school_grade: '5' }).success).toBe(false);
    const ok = studentSchema.parse({ full_name: 'Asha', student_code: 'S-1', current_school_grade: '5', class_id: '' });
    expect(ok.class_id).toBeUndefined();
  });
  it('year and report ranges', () => {
    expect(yearSchema.safeParse({ name: 'x', start_date: '2026-06-01', end_date: '2026-05-01' }).success).toBe(false);
    expect(reportFilterSchema.safeParse({ from: '2026-01-01', to: '2028-01-01' }).success).toBe(false);
    expect(reportFilterSchema.safeParse({ from: '2026-01-01', to: '2026-03-01' }).success).toBe(true);
  });
});

import type { Outcome } from './assessment';

export type HistoryPoint = { date: string; outcome: Outcome };
export type TopicFlag = 'follow_up' | 'revision' | 'repeated_difficulty' | 'improved' | 'on_track' | 'stale';
export type TopicStatus = { current: Outcome; lastAssessed: string; flags: TopicFlag[]; attempts: number };

export const STALE_DAYS = 30;
export const REPEATED_WINDOW = 3;

/**
 * Transparent rules (docs/PRODUCT_SPEC.md). History is never altered.
 *  - current status = most recent outcome for the topic
 *  - didnt_understand -> follow_up ; needs_revision -> revision
 *  - repeated_difficulty: >=2 of the last 3 outcomes not "understood" AND latest not understood
 *  - improved: latest understood and an earlier outcome was not
 *  - stale: last assessed more than 30 days before `today`
 * No numeric mastery score is produced.
 */
export function topicStatus(history: HistoryPoint[], today: Date): TopicStatus | null {
  if (history.length === 0) return null;
  const h = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const last = h[h.length - 1];
  const flags: TopicFlag[] = [];
  if (last.outcome === 'didnt_understand') flags.push('follow_up');
  if (last.outcome === 'needs_revision') flags.push('revision');
  const window = h.slice(-REPEATED_WINDOW);
  if (last.outcome !== 'understood' && window.filter((p) => p.outcome !== 'understood').length >= 2) flags.push('repeated_difficulty');
  if (last.outcome === 'understood') flags.push(h.slice(0, -1).some((p) => p.outcome !== 'understood') ? 'improved' : 'on_track');
  const ageDays = (today.getTime() - new Date(last.date).getTime()) / 86_400_000;
  if (ageDays > STALE_DAYS) flags.push('stale');
  return { current: last.outcome, lastAssessed: last.date, flags, attempts: h.length };
}

export const FLAG_LABEL: Record<TopicFlag, string> = {
  follow_up: 'Needs follow-up',
  revision: 'Revision recommended',
  repeated_difficulty: 'Repeated difficulty: extra practice may help',
  improved: 'Recent improvement',
  on_track: 'Understood',
  stale: 'Not assessed recently',
};

export type ResultRow = { studentId: string; topicId: string; date: string; outcome: Outcome };

export function statusesByStudentTopic(rows: ResultRow[], today: Date) {
  const map = new Map<string, { studentId: string; topicId: string; history: HistoryPoint[] }>();
  for (const r of rows) {
    const k = `${r.studentId}|${r.topicId}`;
    if (!map.has(k)) map.set(k, { studentId: r.studentId, topicId: r.topicId, history: [] });
    map.get(k)!.history.push({ date: r.date, outcome: r.outcome });
  }
  return [...map.values()].map((e) => ({ studentId: e.studentId, topicId: e.topicId, status: topicStatus(e.history, today)! }));
}

/** Counts only, never averaged into a score. */
export function distribution(outcomes: Outcome[]) {
  const d = { understood: 0, needs_revision: 0, didnt_understand: 0 };
  for (const o of outcomes) d[o]++;
  return { ...d, total: outcomes.length };
}

/** Topics where at least `minStudents` students (and >= `minShare` of those assessed) currently need follow-up/revision. */
export function strugglingTopics(
  statuses: { studentId: string; topicId: string; status: TopicStatus }[], minStudents = 2, minShare = 0.4,
) {
  const by = new Map<string, { assessed: number; struggling: number }>();
  for (const s of statuses) {
    const e = by.get(s.topicId) ?? { assessed: 0, struggling: 0 };
    e.assessed++;
    if (s.status.current !== 'understood') e.struggling++;
    by.set(s.topicId, e);
  }
  return [...by.entries()]
    .filter(([, e]) => e.struggling >= minStudents && e.struggling / e.assessed >= minShare)
    .map(([topicId, e]) => ({ topicId, ...e }))
    .sort((a, b) => b.struggling - a.struggling);
}

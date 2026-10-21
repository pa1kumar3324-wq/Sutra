import type { Attendance } from './assessment';

/**
 * attended = present + late;  eligible = present + late + absent (excused excluded);
 * percentage = attended / eligible. Sessions with NO attendance record are never counted
 * as absences. Returns null when eligible = 0.
 */
export function attendanceSummary(statuses: Attendance[]) {
  const c = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const s of statuses) c[s]++;
  const eligible = c.present + c.late + c.absent;
  return { ...c, recorded: statuses.length, eligible,
    percentage: eligible === 0 ? null : Math.round(((c.present + c.late) / eligible) * 1000) / 10 };
}

/** Consecutive most-recent absences (excused sessions are skipped, not counted as a break). */
export function recentAbsenceStreak(chronological: Attendance[]): number {
  let n = 0;
  for (let i = chronological.length - 1; i >= 0; i--) {
    const s = chronological[i];
    if (s === 'excused') continue;
    if (s === 'absent') n++; else break;
  }
  return n;
}

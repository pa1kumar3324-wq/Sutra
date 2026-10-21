# Product spec

## Scope
Digital register for a free-tuition trust: students, grade-based classes, teaching assignments, sessions, attendance,
post-class understanding assessment, history, reports. Not in the MVP: parent portal, numeric/formal grading, scheduling/timetables,
SMS/email notifications, PDF/Excel export, student photos, AI features, offline mode, an organization switcher UI (the schema supports several organizations per user).

## Roles
- **Owner / Admin**: everything in their organization. Only an owner can create or change admins.
- **Teacher**: only classes/subjects they are assigned; only sessions they own; sees student outcomes recorded in their own sessions.
- Coordinator / Auditor: read-only roles reserved in the schema (RLS already grants read access); no UI beyond reports.

## Session workflow
1. Teacher starts a session for an assignment (class + subject), date, topics, notes. Double-submit is idempotent (request key).
2. Attendance: present / absent / late / excused. One row per student per session. Roster = students enrolled on the session date.
3. Assessment: one outcome per present/late/excused student per topic. Absent or unrecorded students are **not assessed** (not an outcome).
4. Finish: allowed only when every enrolled student has attendance and every non-absent student has every topic outcome.
5. After completion, corrections need a reason; each change is stored in `assessment_result_history`.
Session status: draft → in progress → completed.

## Attendance %
`(present + late) / (present + late + absent)`. Excused sessions and sessions with no record are excluded from the denominator. `–` when nothing is eligible.

## Revision rules (deterministic, no scores)
Per student and topic, history is sorted by session date. Current status = latest outcome.
- latest *Didn't Understand* → **Needs follow-up**; latest *Needs Revision* → **Revision recommended**
- ≥2 of the last 3 not *Understood* and latest not *Understood* → **Repeated difficulty**
- latest *Understood* after an earlier non-understood → **Recent improvement**
- last assessed > 30 days ago → **Not assessed recently**
Class-level "topics many students find hard": ≥2 students and ≥40% of assessed students currently not *Understood*.

## Student lifecycle
Enrol, transfer (old enrolment kept as `transferred`), end, inactive, graduated, withdrawn. Nothing is deleted; history is retained.
Re-enrolment: enrol again (set the student active first).

## Decisions where the brief was ambiguous
- Observations are visible only to their author and administrators.
- A teacher's view of a student contains only results from that teacher's own sessions.
- Absent → present corrections are allowed; present → absent is blocked once results exist (prevents orphaned outcomes).
- Reports cap at 20,000 rows per query and a one-year range; the UI says when it truncates.

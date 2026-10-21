# Database

Migrations (apply in order): `0001_schema.sql` tables/constraints · `0002_functions_triggers.sql` helpers, integrity triggers, RPCs · `0003_rls.sql` grants and policies.

## Entities
organizations → academic_years → classes; subjects → topics; students → enrollments (student × class × year);
teaching_assignments (teacher × class × subject × year) → class_sessions → session_topics, attendance_records, assessments → assessment_results → assessment_result_history;
learning_observations; audit_logs; profiles (1:1 with auth.users); organization_memberships (role per org).

## Key constraints
- **Tenant integrity**: every child has `organization_id` and uses composite FKs `(id, organization_id)` to parents, so cross-tenant references are impossible.
- `students(organization_id, student_code)` unique; one active enrolment per student per class and per academic year (partial unique indexes).
- One attendance row per session+student; one result per session+student+topic; one assessment per session; idempotent sessions via `(organization_id, request_key)`.
- `assessment_outcome` is a Postgres enum with exactly `understood | needs_revision | didnt_understand`.
- Triggers enforce: topic belongs to the session's subject; topic was taught in the session; student enrolled on the session date; no outcome for absent/unrecorded students; session class/subject/teacher copied from the assignment and immutable; membership privilege rules; history/audit tables append-only.
- No `ON DELETE CASCADE` anywhere; deletes are revoked for the app role (except removing a session↔topic link that has no results).

## RLS strategy
Default deny, RLS forced on all tables. Helper functions (`app_is_admin`, `app_teaches_class`, `app_owns_session`, …) are SECURITY DEFINER with a fixed `search_path`, only describe `auth.uid()`, and require an **active** membership and active profile, so deactivation applies to the next query even with a valid JWT. Anonymous role has no privileges. Profiles: users may update only `display_name`/`phone` (column grant).

## Migrations workflow
Use the Supabase CLI: `supabase link`, `supabase db push` (or paste each file into the SQL editor in order). Never edit an applied migration; add `0004_…`. Back up (Supabase PITR/backups) before production migrations. Roll back by restoring a backup or writing a forward fix migration.

## Retention
Student and outcome history is kept for the life of the organization. Withdraw/graduate instead of deleting. Deletion on request must be a documented, manual, admin-approved procedure (it requires disabling the append-only triggers deliberately).

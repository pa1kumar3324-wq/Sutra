-- 0003_rls.sql : Row Level Security. Default deny; every policy is scoped by organization.

-- profile row is created automatically for each new auth user (never trusting client input)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ── privileges: anonymous gets nothing; authenticated gets only what policies can then narrow ──
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
revoke delete, truncate on all tables in schema public from authenticated;
grant delete on session_topics to authenticated;
revoke insert, update on audit_logs, assessment_result_history from authenticated;
revoke insert on organizations, profiles from authenticated;
revoke update on profiles from authenticated;
grant update (display_name, phone) on profiles to authenticated;   -- cannot touch account_status / email / id

do $$ declare t text; begin
  foreach t in array array['organizations','profiles','organization_memberships','academic_years','classes','subjects','topics',
    'students','enrollments','teaching_assignments','class_sessions','session_topics','attendance_records','assessments',
    'assessment_results','assessment_result_history','learning_observations','audit_logs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop; end $$;

-- ── organizations & identity ──
create policy org_select on organizations for select to authenticated using (app_is_member(id));
create policy org_update on organizations for update to authenticated using (app_is_admin(id)) with check (app_is_admin(id));

create policy profile_select_self on profiles for select to authenticated using (id = auth.uid());
create policy profile_select_staff on profiles for select to authenticated using (
  exists (select 1 from organization_memberships m where m.user_id = profiles.id and app_can_read_all(m.organization_id)));
create policy profile_update_self on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy member_select_self on organization_memberships for select to authenticated using (user_id = auth.uid());
create policy member_select_staff on organization_memberships for select to authenticated using (app_can_read_all(organization_id));
create policy member_insert on organization_memberships for insert to authenticated with check (app_is_admin(organization_id));
create policy member_update on organization_memberships for update to authenticated
  using (app_is_admin(organization_id)) with check (app_is_admin(organization_id));

-- ── administrators: insert/update; staff-wide read; (no deletes: history is retained) ──
do $$ declare t text; begin
  foreach t in array array['academic_years','classes','subjects','topics','students','enrollments','teaching_assignments',
    'class_sessions','session_topics','attendance_records','assessments','assessment_results','learning_observations'] loop
    execute format('create policy %1$s_admin_insert on %1$I for insert to authenticated with check (app_is_admin(organization_id))', t);
    execute format('create policy %1$s_admin_update on %1$I for update to authenticated using (app_is_admin(organization_id)) with check (app_is_admin(organization_id))', t);
  end loop;
  -- organisation-wide read for owner/admin/coordinator/auditor (observations are excluded: see below)
  foreach t in array array['academic_years','classes','subjects','topics','students','enrollments','teaching_assignments',
    'class_sessions','session_topics','attendance_records','assessments','assessment_results'] loop
    execute format('create policy %1$s_readall on %1$I for select to authenticated using (app_can_read_all(organization_id))', t);
  end loop; end $$;

-- ── teachers: strictly scoped to what they teach ──
create policy years_member_read on academic_years for select to authenticated using (app_is_member(organization_id));
create policy subjects_member_read on subjects for select to authenticated using (app_is_member(organization_id));
create policy topics_member_read on topics for select to authenticated using (app_is_member(organization_id));
create policy topics_teacher_insert on topics for insert to authenticated with check (app_teaches_subject(subject_id));

create policy classes_teacher_read on classes for select to authenticated using (app_teaches_class(id));
create policy assign_teacher_read on teaching_assignments for select to authenticated
  using (teacher_user_id = auth.uid() and app_is_member(organization_id));
create policy students_teacher_read on students for select to authenticated using (app_teaches_student(id));
create policy enroll_teacher_read on enrollments for select to authenticated using (app_teaches_class(class_id));

create policy sessions_teacher_read on class_sessions for select to authenticated
  using (teacher_user_id = auth.uid() and app_is_member(organization_id));
create policy sessions_teacher_insert on class_sessions for insert to authenticated
  with check (teacher_user_id = auth.uid() and app_is_member(organization_id));
create policy sessions_teacher_update on class_sessions for update to authenticated
  using (teacher_user_id = auth.uid() and app_is_member(organization_id))
  with check (teacher_user_id = auth.uid() and app_is_member(organization_id));

create policy stopics_teacher_read on session_topics for select to authenticated using (app_owns_session(class_session_id));
create policy stopics_teacher_insert on session_topics for insert to authenticated with check (app_owns_session(class_session_id));
create policy stopics_owner_delete on session_topics for delete to authenticated
  using (app_owns_session(class_session_id) or app_is_admin(organization_id));

create policy att_teacher_read on attendance_records for select to authenticated using (app_owns_session(class_session_id));
create policy att_teacher_insert on attendance_records for insert to authenticated with check (app_owns_session(class_session_id));
create policy att_teacher_update on attendance_records for update to authenticated
  using (app_owns_session(class_session_id)) with check (app_owns_session(class_session_id));

create policy asmt_teacher_read on assessments for select to authenticated using (app_owns_session(class_session_id));
create policy asmt_teacher_insert on assessments for insert to authenticated
  with check (app_owns_session(class_session_id) and created_by = auth.uid());
create policy asmt_teacher_update on assessments for update to authenticated
  using (app_owns_session(class_session_id)) with check (app_owns_session(class_session_id));

create policy res_teacher_read on assessment_results for select to authenticated using (app_owns_session(class_session_id));
create policy res_teacher_insert on assessment_results for insert to authenticated with check (app_owns_session(class_session_id));
create policy res_teacher_update on assessment_results for update to authenticated
  using (app_owns_session(class_session_id)) with check (app_owns_session(class_session_id));

create policy hist_read on assessment_result_history for select to authenticated using (
  app_can_read_all(organization_id) or exists (
    select 1 from assessment_results r where r.id = assessment_result_id and app_owns_session(r.class_session_id)));

-- observations: author or administrators only
create policy obs_read on learning_observations for select to authenticated
  using (author_user_id = auth.uid() or app_is_admin(organization_id));
create policy obs_insert_author on learning_observations for insert to authenticated
  with check (author_user_id = auth.uid() and app_owns_session(class_session_id));
create policy obs_update_author on learning_observations for update to authenticated
  using (author_user_id = auth.uid()) with check (author_user_id = auth.uid());

-- audit: readable by owner/admin/auditor; written only by triggers and app_audit()
create policy audit_read on audit_logs for select to authenticated
  using (app_has_role(organization_id, array['owner','admin','auditor']::member_role[]));

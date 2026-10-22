-- 0002_functions_triggers.sql : authorization helpers, integrity triggers, transactional RPCs.

alter table learning_observations
  add constraint learning_observations_topic_fk foreign key (topic_id, organization_id)
  references topics (id, organization_id) on delete restrict;

-- ───────────── authorization helpers (used by RLS and RPCs) ─────────────
-- SECURITY DEFINER so they can read memberships regardless of caller RLS.
-- They only ever answer questions about auth.uid(), and pin search_path.
-- Every one requires an ACTIVE membership AND an active profile, so deactivation
-- takes effect on the very next query even if the user's JWT is still valid.

create or replace function app_has_role(org uuid, roles member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_memberships m join profiles p on p.id = m.user_id
    where m.organization_id = org and m.user_id = auth.uid()
      and m.status = 'active' and p.account_status = 'active' and m.role = any(roles));
$$;

create or replace function app_is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app_has_role(org, enum_range(null::member_role));
$$;

create or replace function app_is_admin(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app_has_role(org, array['owner','admin']::member_role[]);
$$;

-- coordinators/auditors/admins/owners may read organisation-wide data
create or replace function app_can_read_all(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app_has_role(org, array['owner','admin','coordinator','auditor']::member_role[]);
$$;

create or replace function app_teaches_class(cls uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teaching_assignments ta
    where ta.class_id = cls and ta.teacher_user_id = auth.uid() and ta.status = 'active'
      and app_is_member(ta.organization_id));
$$;

create or replace function app_teaches_subject(subj uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teaching_assignments ta
    where ta.subject_id = subj and ta.teacher_user_id = auth.uid() and ta.status = 'active'
      and app_is_member(ta.organization_id));
$$;

create or replace function app_owns_session(sess uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_sessions s
    where s.id = sess and s.teacher_user_id = auth.uid() and app_is_member(s.organization_id));
$$;

-- a teacher may see a student who is/was enrolled in a class they currently teach
create or replace function app_teaches_student(stu uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollments e
    join teaching_assignments ta on ta.class_id = e.class_id and ta.organization_id = e.organization_id
    where e.student_id = stu and ta.teacher_user_id = auth.uid() and ta.status = 'active'
      and app_is_member(e.organization_id));
$$;

revoke all on function app_has_role(uuid, member_role[]) from public;
grant execute on function app_has_role(uuid, member_role[]) to authenticated;
do $$ declare f text; begin
  foreach f in array array['app_is_member(uuid)','app_is_admin(uuid)','app_can_read_all(uuid)','app_teaches_class(uuid)',
    'app_teaches_subject(uuid)','app_owns_session(uuid)','app_teaches_student(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop; end $$;

-- ───────────── integrity triggers (SECURITY DEFINER: validation must see all rows) ─────────────

create or replace function trg_membership_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then                       -- null = service role / migrations
    if new.user_id = auth.uid() then
      raise exception 'You cannot change your own membership';
    end if;
    if new.role in ('owner','admin') and not app_has_role(new.organization_id, array['owner']::member_role[]) then
      raise exception 'Only an owner can grant or change owner/admin roles';
    end if;
    if tg_op = 'UPDATE' and old.role in ('owner','admin') and not app_has_role(old.organization_id, array['owner']::member_role[]) then
      raise exception 'Only an owner can change an owner/admin membership';
    end if;
  end if;
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.user_id <> old.user_id) then
    raise exception 'Membership organization and user are immutable';
  end if;
  return new;
end $$;
create trigger trg_membership_guard before insert or update on organization_memberships
  for each row execute function trg_membership_guard();

create or replace function trg_enrollment_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c classes%rowtype; st students%rowtype;
begin
  select * into c from classes where id = new.class_id and organization_id = new.organization_id;
  if c.academic_year_id is distinct from new.academic_year_id then
    raise exception 'Enrollment academic year must match the class academic year';
  end if;
  if tg_op = 'INSERT' then
    if c.status <> 'active' then raise exception 'Cannot enroll into an archived class'; end if;
    select * into st from students where id = new.student_id and organization_id = new.organization_id;
    if st.enrollment_status <> 'active' then raise exception 'Student is not active'; end if;
  elsif new.student_id <> old.student_id or new.class_id <> old.class_id then
    raise exception 'Enrollment student and class are immutable; transfer instead';
  end if;
  return new;
end $$;
create trigger trg_enrollment_guard before insert or update on enrollments
  for each row execute function trg_enrollment_guard();

create or replace function trg_assignment_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c classes%rowtype;
begin
  select * into c from classes where id = new.class_id and organization_id = new.organization_id;
  if c.academic_year_id is distinct from new.academic_year_id then
    raise exception 'Assignment academic year must match the class academic year';
  end if;
  if not exists (select 1 from organization_memberships m
                 where m.organization_id = new.organization_id and m.user_id = new.teacher_user_id) then
    raise exception 'Teacher is not a member of this organization';
  end if;
  return new;
end $$;
create trigger trg_assignment_guard before insert or update on teaching_assignments
  for each row execute function trg_assignment_guard();

create or replace function trg_session_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare a teaching_assignments%rowtype;
begin
  select * into a from teaching_assignments
   where id = new.teaching_assignment_id and organization_id = new.organization_id;
  if not found then raise exception 'Unknown teaching assignment'; end if;
  if tg_op = 'INSERT' then
    if a.status <> 'active' then raise exception 'Teaching assignment is not active'; end if;
    new.class_id := a.class_id; new.subject_id := a.subject_id; new.teacher_user_id := a.teacher_user_id;
  else
    if new.teaching_assignment_id <> old.teaching_assignment_id or new.class_id <> old.class_id
       or new.subject_id <> old.subject_id or new.teacher_user_id <> old.teacher_user_id then
      raise exception 'Session assignment, class, subject and teacher are immutable';
    end if;
  end if;
  return new;
end $$;
create trigger trg_session_guard before insert or update on class_sessions
  for each row execute function trg_session_guard();

create or replace function trg_session_topic_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare s class_sessions%rowtype; t topics%rowtype;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from assessment_results r where r.class_session_id = old.class_session_id and r.topic_id = old.topic_id) then
      raise exception 'Topic already has assessment results for this session and cannot be removed';
    end if;
    return old;
  end if;
  select * into s from class_sessions where id = new.class_session_id and organization_id = new.organization_id;
  select * into t from topics where id = new.topic_id and organization_id = new.organization_id;
  if s.subject_id is distinct from t.subject_id then
    raise exception 'Topic does not belong to the subject taught in this session';
  end if;
  return new;
end $$;
create trigger trg_session_topic_guard before insert or delete on session_topics
  for each row execute function trg_session_topic_guard();

create or replace function trg_attendance_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare s class_sessions%rowtype; e enrollments%rowtype;
begin
  select * into s from class_sessions where id = new.class_session_id and organization_id = new.organization_id;
  select * into e from enrollments where id = new.enrollment_id and organization_id = new.organization_id;
  if e.student_id is distinct from new.student_id or e.class_id is distinct from s.class_id
     or e.start_date > s.session_date or (e.end_date is not null and e.end_date < s.session_date) then
    raise exception 'Student was not enrolled in this class on the session date';
  end if;
  if tg_op = 'UPDATE' then
    if new.student_id <> old.student_id or new.class_session_id <> old.class_session_id then
      raise exception 'Attendance student and session are immutable';
    end if;
    if new.status = 'absent' and exists (select 1 from assessment_results r
         where r.class_session_id = new.class_session_id and r.student_id = new.student_id) then
      raise exception 'Student already has assessment results for this session; cannot mark absent';
    end if;
  end if;
  new.recorded_by := coalesce(auth.uid(), new.recorded_by);
  if tg_op = 'UPDATE' then new.recorded_at := now(); end if;
  return new;
end $$;
create trigger trg_attendance_guard before insert or update on attendance_records
  for each row execute function trg_attendance_guard();

create or replace function trg_result_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare a assessments%rowtype;
begin
  select * into a from assessments where id = new.assessment_id and organization_id = new.organization_id;
  if a.class_session_id is distinct from new.class_session_id then
    raise exception 'Assessment does not belong to this session';
  end if;
  if tg_op = 'UPDATE' and (new.student_id <> old.student_id or new.topic_id <> old.topic_id
       or new.class_session_id <> old.class_session_id) then
    raise exception 'Result student, topic and session are immutable';
  end if;
  if not exists (select 1 from session_topics st where st.class_session_id = new.class_session_id and st.topic_id = new.topic_id) then
    raise exception 'Topic was not taught in this session';
  end if;
  if not exists (select 1 from attendance_records ar where ar.class_session_id = new.class_session_id
                 and ar.student_id = new.student_id and ar.status <> 'absent') then
    raise exception 'Student has no attendance record, or was absent; learning outcome cannot be recorded';
  end if;
  new.recorded_by := coalesce(auth.uid(), new.recorded_by);
  if tg_op = 'UPDATE' then new.assessed_at := now(); end if;
  return new;
end $$;
create trigger trg_result_guard before insert or update on assessment_results
  for each row execute function trg_result_guard();

-- history of corrections (append-only)
create or replace function trg_result_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.outcome is distinct from old.outcome then
    insert into assessment_result_history (organization_id, assessment_result_id, previous_outcome, new_outcome, changed_by, change_reason)
    values (new.organization_id, new.id, old.outcome, new.outcome, auth.uid(),
            nullif(current_setting('app.change_reason', true), ''));
  end if;
  return new;
end $$;
create trigger trg_result_history after update on assessment_results
  for each row execute function trg_result_history();

create or replace function trg_append_only() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger trg_history_append_only before update or delete on assessment_result_history
  for each row execute function trg_append_only();
create trigger trg_audit_append_only before update or delete on audit_logs
  for each row execute function trg_append_only();

-- generic audit trigger: logs only a whitelist of non-personal fields
create or replace function trg_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare keys text[] := array['status','role','outcome','enrollment_status','class_id','subject_id','teacher_user_id'];
        k text; meta jsonb := jsonb_build_object('op', tg_op); o jsonb; n jsonb; org uuid;
begin
  n := to_jsonb(new); o := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  org := new.organization_id;
  foreach k in array keys loop
    if n ? k then
      meta := meta || jsonb_build_object(k, n->k);
      if o ? k and o->k is distinct from n->k then meta := meta || jsonb_build_object('previous_' || k, o->k); end if;
    end if;
  end loop;
  insert into audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (org, auth.uid(), lower(tg_op), tg_table_name, (n->>'id')::uuid, meta);
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['organization_memberships','enrollments','teaching_assignments','classes','subjects','students'] loop
    execute format('create trigger trg_audit after insert or update on %I for each row execute function trg_audit()', t);
  end loop; end $$;
create trigger trg_audit_upd after update on attendance_records for each row execute function trg_audit();
create trigger trg_audit_upd after update on assessment_results for each row execute function trg_audit();

-- explicit audit entry from the app (e.g. exports)
create or replace function app_audit(p_org uuid, p_action text, p_entity_type text, p_entity_id uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not app_is_member(p_org) then raise exception 'Not a member of this organization'; end if;
  insert into audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_org, auth.uid(), left(p_action, 64), left(p_entity_type, 64), p_entity_id, coalesce(p_meta, '{}'::jsonb));
end $$;
revoke all on function app_audit(uuid, text, text, uuid, jsonb) from public;
grant execute on function app_audit(uuid, text, text, uuid, jsonb) to authenticated;

-- ───────────── transactional RPCs (SECURITY INVOKER: RLS + triggers apply) ─────────────

create or replace function create_class_session(
  p_assignment_id uuid, p_session_date date, p_request_key text, p_topic_ids uuid[], p_notes text)
returns uuid language plpgsql as $$
declare a teaching_assignments%rowtype; sid uuid; tid uuid;
begin
  select * into a from teaching_assignments where id = p_assignment_id;   -- RLS-filtered
  if not found then raise exception 'You are not authorised for this teaching assignment'; end if;
  insert into class_sessions (organization_id, teaching_assignment_id, class_id, subject_id, teacher_user_id,
                              session_date, status, lesson_notes, request_key, started_at)
  values (a.organization_id, a.id, a.class_id, a.subject_id, a.teacher_user_id, p_session_date, 'draft',
          nullif(trim(p_notes), ''), nullif(p_request_key, ''), now())
  on conflict (organization_id, request_key) do nothing
  returning id into sid;
  if sid is null then                                   -- repeated submit: return the original session
    select id into sid from class_sessions where organization_id = a.organization_id and request_key = p_request_key;
    return sid;
  end if;
  insert into assessments (organization_id, class_session_id, created_by) values (a.organization_id, sid, auth.uid());
  foreach tid in array coalesce(p_topic_ids, '{}') loop
    insert into session_topics (organization_id, class_session_id, topic_id) values (a.organization_id, sid, tid);
  end loop;
  return sid;
end $$;

create or replace function set_session_topics(p_session_id uuid, p_topic_ids uuid[], p_notes text)
returns void language plpgsql as $$
declare s class_sessions%rowtype; tid uuid;
begin
  select * into s from class_sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  delete from session_topics where class_session_id = s.id and not (topic_id = any(coalesce(p_topic_ids, '{}')));
  foreach tid in array coalesce(p_topic_ids, '{}') loop
    insert into session_topics (organization_id, class_session_id, topic_id) values (s.organization_id, s.id, tid)
    on conflict (class_session_id, topic_id) do nothing;
  end loop;
  update class_sessions set lesson_notes = nullif(trim(p_notes), '') where id = s.id;
end $$;

create or replace function save_attendance(p_session_id uuid, p_records jsonb)
returns integer language plpgsql as $$
declare s class_sessions%rowtype; r jsonb; enr uuid; n integer := 0;
begin
  select * into s from class_sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  for r in select * from jsonb_array_elements(p_records) loop
    select e.id into enr from enrollments e
     where e.student_id = (r->>'student_id')::uuid and e.class_id = s.class_id
       and e.start_date <= s.session_date and (e.end_date is null or e.end_date >= s.session_date)
     order by e.start_date desc limit 1;
    if enr is null then raise exception 'Student is not enrolled in this class for the session date'; end if;
    insert into attendance_records (organization_id, class_session_id, student_id, enrollment_id, status, recorded_by)
    values (s.organization_id, s.id, (r->>'student_id')::uuid, enr, (r->>'status')::attendance_status, auth.uid())
    on conflict (class_session_id, student_id) do update
      set status = excluded.status, enrollment_id = excluded.enrollment_id
      where attendance_records.status is distinct from excluded.status;
    n := n + 1;
  end loop;
  if s.status = 'draft' then update class_sessions set status = 'in_progress' where id = s.id; end if;
  return n;
end $$;

create or replace function save_assessment_results(p_session_id uuid, p_results jsonb, p_reason text default null)
returns integer language plpgsql as $$
declare s class_sessions%rowtype; a assessments%rowtype; r jsonb; n integer := 0; changing integer;
begin
  select * into s from class_sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  select * into a from assessments where class_session_id = s.id;
  select count(*) into changing from jsonb_array_elements(p_results) j
    join assessment_results ar on ar.class_session_id = s.id
     and ar.student_id = (j->>'student_id')::uuid and ar.topic_id = (j->>'topic_id')::uuid
   where ar.outcome <> (j->>'outcome')::assessment_outcome;
  if changing > 0 and a.status = 'completed' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required to correct a completed assessment';
  end if;
  perform set_config('app.change_reason', coalesce(trim(p_reason), ''), true);
  for r in select * from jsonb_array_elements(p_results) loop
    insert into assessment_results (organization_id, assessment_id, class_session_id, student_id, topic_id, outcome, recorded_by)
    values (s.organization_id, a.id, s.id, (r->>'student_id')::uuid, (r->>'topic_id')::uuid,
            (r->>'outcome')::assessment_outcome, auth.uid())
    on conflict (class_session_id, student_id, topic_id) do update
      set outcome = excluded.outcome where assessment_results.outcome is distinct from excluded.outcome;
    n := n + 1;
  end loop;
  if a.status = 'pending' then
    update assessments set status = 'in_progress', started_at = now() where id = a.id;
  end if;
  return n;
end $$;

create or replace function complete_assessment(p_session_id uuid)
returns void language plpgsql as $$
declare s class_sessions%rowtype; unrecorded integer; missing integer;
begin
  select * into s from class_sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  select count(*) into unrecorded from enrollments e
   where e.class_id = s.class_id and e.start_date <= s.session_date and (e.end_date is null or e.end_date >= s.session_date)
     and not exists (select 1 from attendance_records ar where ar.class_session_id = s.id and ar.student_id = e.student_id);
  if unrecorded > 0 then raise exception 'Attendance is incomplete: % student(s) have no attendance status', unrecorded; end if;
  select count(*) into missing from attendance_records ar cross join session_topics st
   where ar.class_session_id = s.id and st.class_session_id = s.id and ar.status <> 'absent'
     and not exists (select 1 from assessment_results r where r.class_session_id = s.id
                      and r.student_id = ar.student_id and r.topic_id = st.topic_id);
  if missing > 0 then raise exception 'Assessment is incomplete: % outcome(s) still missing', missing; end if;
  update assessments set status = 'completed', completed_at = now() where class_session_id = s.id;
  update class_sessions set status = 'completed', ended_at = now() where id = s.id;
end $$;

create or replace function transfer_enrollment(p_enrollment_id uuid, p_new_class_id uuid, p_date date)
returns uuid language plpgsql as $$
declare e enrollments%rowtype; c classes%rowtype; nid uuid;
begin
  select * into e from enrollments where id = p_enrollment_id;
  if not found then raise exception 'Enrollment not found'; end if;
  if not app_is_admin(e.organization_id) then raise exception 'Only administrators can transfer students'; end if;
  select * into c from classes where id = p_new_class_id and organization_id = e.organization_id;
  if not found then raise exception 'Target class not found'; end if;
  if p_date < e.start_date then raise exception 'Transfer date is before the enrollment start'; end if;
  update enrollments set status = 'transferred', end_date = p_date where id = e.id;
  insert into enrollments (organization_id, student_id, class_id, academic_year_id, start_date)
  values (e.organization_id, e.student_id, c.id, c.academic_year_id, p_date) returning id into nid;
  return nid;
end $$;

REVOKE EXECUTE ON FUNCTION public.create_class_session(uuid, date, text, uuid[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_session_topics(uuid, uuid[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_attendance(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_assessment_results(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_assessment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.transfer_enrollment(uuid, uuid, date) FROM PUBLIC, anon;

-- Keep the existing GRANT statements below these.
grant execute on function create_class_session(uuid, date, text, uuid[], text) to authenticated;
grant execute on function set_session_topics(uuid, uuid[], text) to authenticated;
grant execute on function save_attendance(uuid, jsonb) to authenticated;
grant execute on function save_assessment_results(uuid, jsonb, text) to authenticated;
grant execute on function complete_assessment(uuid) to authenticated;
grant execute on function transfer_enrollment(uuid, uuid, date) to authenticated;

-- 0001_schema.sql : core schema. Forward-only migration.
-- Tenant integrity: every child table carries organization_id and references its
-- parents with COMPOSITE foreign keys (id, organization_id), so a row can never
-- point at a parent that belongs to a different organization.


-- ───────────── enums ─────────────
create type member_role as enum ('owner','admin','teacher','coordinator','auditor');
create type member_status as enum ('invited','active','deactivated');
create type account_status as enum ('active','disabled');
create type record_status as enum ('active','archived');
create type year_status as enum ('planned','active','closed');
create type enrollment_status as enum ('active','completed','transferred','withdrawn');
create type student_status as enum ('active','inactive','graduated','withdrawn');
create type session_status as enum ('draft','in_progress','completed');
create type assessment_status as enum ('pending','in_progress','completed');
create type attendance_status as enum ('present','absent','late','excused');
create type assessment_outcome as enum ('understood','needs_revision','didnt_understand');

-- ───────────── generic trigger ─────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────── organizations / identity ─────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  contact_email text,
  timezone text not null default 'UTC',
  academic_year_start_month smallint not null default 6 check (academic_year_start_month between 1 and 12),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text,
  phone text,
  account_status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  user_id uuid not null references profiles(id) on delete restrict,
  role member_role not null,
  status member_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index on organization_memberships (user_id) where status = 'active';

-- ───────────── academic structure ─────────────
create table academic_years (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  name text not null,
  start_date date not null,
  end_date date not null,
  status year_status not null default 'planned',
  created_at timestamptz not null default now(),
  check (end_date > start_date),
  unique (organization_id, name),
  unique (id, organization_id)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  academic_year_id uuid not null,
  name text not null,
  grade_level text not null,          -- free text so grade structure is configurable
  section text,
  description text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, academic_year_id, name),
  unique (id, organization_id),
  foreign key (academic_year_id, organization_id) references academic_years (id, organization_id) on delete restrict
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  name text not null,
  description text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  subject_id uuid not null,
  name text not null,
  description text,
  sequence_order integer,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, name),
  unique (id, organization_id),
  unique (id, subject_id),
  foreign key (subject_id, organization_id) references subjects (id, organization_id) on delete restrict
);
create index on topics (organization_id, subject_id);

create table students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  student_code text not null check (length(trim(student_code)) > 0),
  full_name text not null check (length(trim(full_name)) > 0),
  date_of_birth date,
  current_school_grade text not null,
  school_name text,
  enrollment_status student_status not null default 'active',
  joined_at date not null default current_date,
  left_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (left_at is null or left_at >= joined_at),
  unique (organization_id, student_code),
  unique (id, organization_id)
);
create index on students (organization_id, full_name);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  student_id uuid not null,
  class_id uuid not null,
  academic_year_id uuid not null,
  start_date date not null default current_date,
  end_date date,
  status enrollment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  unique (id, organization_id),
  unique (id, student_id, class_id),
  foreign key (student_id, organization_id) references students (id, organization_id) on delete restrict,
  foreign key (class_id, organization_id) references classes (id, organization_id) on delete restrict,
  foreign key (academic_year_id, organization_id) references academic_years (id, organization_id) on delete restrict
);
-- one active enrollment per student per class, and per student per academic year
create unique index enrollments_one_active_per_class on enrollments (student_id, class_id) where status = 'active';
create unique index enrollments_one_active_per_year on enrollments (student_id, academic_year_id) where status = 'active';
create index on enrollments (organization_id, class_id) ;

create table teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  class_id uuid not null,
  subject_id uuid not null,
  teacher_user_id uuid not null references profiles(id) on delete restrict,
  academic_year_id uuid not null,
  start_date date not null default current_date,
  end_date date,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  unique (id, organization_id),
  foreign key (class_id, organization_id) references classes (id, organization_id) on delete restrict,
  foreign key (subject_id, organization_id) references subjects (id, organization_id) on delete restrict,
  foreign key (academic_year_id, organization_id) references academic_years (id, organization_id) on delete restrict
);
create unique index teaching_assignments_unique_active on teaching_assignments (class_id, subject_id, teacher_user_id) where status = 'active';
create index on teaching_assignments (teacher_user_id) where status = 'active';

-- ───────────── sessions ─────────────
create table class_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  teaching_assignment_id uuid not null,
  class_id uuid not null,            -- denormalised from the assignment by trigger (history survives inactive assignments)
  subject_id uuid not null,
  teacher_user_id uuid not null references profiles(id) on delete restrict,
  session_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  status session_status not null default 'draft',
  lesson_notes text check (length(lesson_notes) <= 2000),
  request_key text,                  -- client idempotency key: stops double-submit duplicates
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, request_key),
  foreign key (teaching_assignment_id, organization_id) references teaching_assignments (id, organization_id) on delete restrict,
  foreign key (class_id, organization_id) references classes (id, organization_id) on delete restrict,
  foreign key (subject_id, organization_id) references subjects (id, organization_id) on delete restrict
);
create index on class_sessions (organization_id, class_id, session_date desc);
create index on class_sessions (teacher_user_id, session_date desc);

create table session_topics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  class_session_id uuid not null,
  topic_id uuid not null,
  created_at timestamptz not null default now(),
  unique (class_session_id, topic_id),
  foreign key (class_session_id, organization_id) references class_sessions (id, organization_id) on delete restrict,
  foreign key (topic_id, organization_id) references topics (id, organization_id) on delete restrict
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  class_session_id uuid not null,
  student_id uuid not null,
  enrollment_id uuid not null,
  status attendance_status not null,
  recorded_by uuid not null references profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_session_id, student_id),
  foreign key (class_session_id, organization_id) references class_sessions (id, organization_id) on delete restrict,
  foreign key (student_id, organization_id) references students (id, organization_id) on delete restrict,
  foreign key (enrollment_id, organization_id) references enrollments (id, organization_id) on delete restrict
);
create index on attendance_records (organization_id, student_id);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  class_session_id uuid not null,
  status assessment_status not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_session_id),
  unique (id, organization_id),
  foreign key (class_session_id, organization_id) references class_sessions (id, organization_id) on delete restrict
);

create table assessment_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  assessment_id uuid not null,
  class_session_id uuid not null,
  student_id uuid not null,
  topic_id uuid not null,
  outcome assessment_outcome not null,   -- exactly three canonical values
  recorded_by uuid not null references profiles(id) on delete restrict,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_session_id, student_id, topic_id),
  unique (id, organization_id),
  foreign key (assessment_id, organization_id) references assessments (id, organization_id) on delete restrict,
  foreign key (class_session_id, organization_id) references class_sessions (id, organization_id) on delete restrict,
  foreign key (student_id, organization_id) references students (id, organization_id) on delete restrict,
  foreign key (topic_id, organization_id) references topics (id, organization_id) on delete restrict
);
create index on assessment_results (organization_id, student_id, assessed_at desc);
create index on assessment_results (organization_id, topic_id);

-- append-only history of outcome corrections
create table assessment_result_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  assessment_result_id uuid not null,
  previous_outcome assessment_outcome not null,
  new_outcome assessment_outcome not null,
  changed_by uuid references profiles(id) on delete restrict,
  change_reason text,
  changed_at timestamptz not null default now(),
  foreign key (assessment_result_id, organization_id) references assessment_results (id, organization_id) on delete restrict
);
create index on assessment_result_history (assessment_result_id);

create table learning_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  student_id uuid not null,
  class_session_id uuid not null,
  topic_id uuid,
  author_user_id uuid not null references profiles(id) on delete restrict,
  observation text not null check (length(observation) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, organization_id) references students (id, organization_id) on delete restrict,
  foreign key (class_session_id, organization_id) references class_sessions (id, organization_id) on delete restrict
);
create index on learning_observations (organization_id, student_id, created_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  actor_user_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on audit_logs (organization_id, created_at desc);

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['organizations','profiles','organization_memberships','classes','subjects','topics',
    'students','enrollments','teaching_assignments','class_sessions','attendance_records','assessments',
    'assessment_results','learning_observations'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at()', t);
  end loop; end $$;

// Runs all migrations against an in-memory Postgres (PGlite) with a stubbed Supabase auth layer,
// then exercises critical invariants and RLS. No Docker or network required.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const dir = path.resolve(__dirname, '../../supabase/migrations');
let db: PGlite;

const ids = {
  org1: '00000000-0000-0000-0000-0000000000a1', org2: '00000000-0000-0000-0000-0000000000a2',
  admin: '10000000-0000-0000-0000-000000000001', t1: '10000000-0000-0000-0000-000000000002',
  t2: '10000000-0000-0000-0000-000000000003', admin2: '10000000-0000-0000-0000-000000000004',
};

async function as(uid: string | null, sql: string, params: any[] = []): Promise<{ rows: any[] }> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return (await db.query(sql, params)) as { rows: any[] }; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
async function fails(uid: string | null, sql: string, re?: RegExp) {
  let err: any = null;
  try { await as(uid, sql); } catch (e) { err = e; }
  expect(err, `expected failure: ${sql}`).not.toBeNull();
  if (re) expect(String(err.message)).toMatch(re);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
  `);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(path.join(dir, f), 'utf8'));
  // fixtures (superuser, bypasses RLS like the service role)
  await db.exec(`
    insert into auth.users (id,email) values
      ('${ids.admin}','a@x'),('${ids.t1}','t1@x'),('${ids.t2}','t2@x'),('${ids.admin2}','a2@x');
    insert into organizations (id,name,slug) values ('${ids.org1}','Trust One','one'),('${ids.org2}','Trust Two','two');
    insert into organization_memberships (organization_id,user_id,role,status) values
      ('${ids.org1}','${ids.admin}','owner','active'),('${ids.org1}','${ids.t1}','teacher','active'),
      ('${ids.org1}','${ids.t2}','teacher','active'),('${ids.org2}','${ids.admin2}','owner','active');
    insert into academic_years (id,organization_id,name,start_date,end_date,status) values
      ('20000000-0000-0000-0000-000000000001','${ids.org1}','2026','2026-06-01','2027-05-31','active'),
      ('20000000-0000-0000-0000-000000000002','${ids.org2}','2026','2026-06-01','2027-05-31','active');
    insert into classes (id,organization_id,academic_year_id,name,grade_level) values
      ('30000000-0000-0000-0000-000000000001','${ids.org1}','20000000-0000-0000-0000-000000000001','Grade 5','5'),
      ('30000000-0000-0000-0000-000000000002','${ids.org1}','20000000-0000-0000-0000-000000000001','Grade 6','6'),
      ('30000000-0000-0000-0000-000000000003','${ids.org2}','20000000-0000-0000-0000-000000000002','Grade 5','5');
    insert into subjects (id,organization_id,name) values
      ('40000000-0000-0000-0000-000000000001','${ids.org1}','Mathematics'),
      ('40000000-0000-0000-0000-000000000002','${ids.org1}','English');
    insert into topics (id,organization_id,subject_id,name) values
      ('50000000-0000-0000-0000-000000000001','${ids.org1}','40000000-0000-0000-0000-000000000001','Fractions'),
      ('50000000-0000-0000-0000-000000000002','${ids.org1}','40000000-0000-0000-0000-000000000001','Decimals'),
      ('50000000-0000-0000-0000-000000000003','${ids.org1}','40000000-0000-0000-0000-000000000002','Nouns');
    insert into students (id,organization_id,student_code,full_name,current_school_grade) values
      ('60000000-0000-0000-0000-000000000001','${ids.org1}','S1','Asha Rao','5'),
      ('60000000-0000-0000-0000-000000000002','${ids.org1}','S2','Ben Dsouza','5'),
      ('60000000-0000-0000-0000-000000000003','${ids.org1}','S3','Chitra Nair','6');
    insert into enrollments (id,organization_id,student_id,class_id,academic_year_id,start_date) values
      ('70000000-0000-0000-0000-000000000001','${ids.org1}','60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-06-01'),
      ('70000000-0000-0000-0000-000000000002','${ids.org1}','60000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-06-01'),
      ('70000000-0000-0000-0000-000000000003','${ids.org1}','60000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','2026-06-01');
    insert into teaching_assignments (id,organization_id,class_id,subject_id,teacher_user_id,academic_year_id) values
      ('80000000-0000-0000-0000-000000000001','${ids.org1}','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','${ids.t1}','20000000-0000-0000-0000-000000000001'),
      ('80000000-0000-0000-0000-000000000002','${ids.org1}','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','${ids.t2}','20000000-0000-0000-0000-000000000001');
  `);
});

const A = '80000000-0000-0000-0000-000000000001';
const S1 = '60000000-0000-0000-0000-000000000001';
const S2 = '60000000-0000-0000-0000-000000000002';
const FR = '50000000-0000-0000-0000-000000000001';
const DEC = '50000000-0000-0000-0000-000000000002';
const NOUN = '50000000-0000-0000-0000-000000000003';
let session = '';

describe('tenant isolation & role scoping', () => {
  it('anonymous cannot read students', async () => { await fails(null, 'select * from students'); });
  it('teacher sees only students of the classes they teach', async () => {
    const r = await as(ids.t1, 'select student_code from students order by 1');
    expect(r.rows.map((x: any) => x.student_code)).toEqual(['S1', 'S2']);
  });
  it('teacher sees only their assigned classes', async () => {
    const r = await as(ids.t1, 'select name from classes');
    expect(r.rows).toHaveLength(1);
  });
  it('other-org admin sees nothing of org1', async () => {
    expect((await as(ids.admin2, 'select * from students')).rows).toHaveLength(0);
    expect((await as(ids.admin2, "select * from classes where organization_id = '" + ids.org1 + "'")).rows).toHaveLength(0);
  });
  it('org1 admin sees all org1 students and none of org2', async () => {
    expect((await as(ids.admin, 'select * from students')).rows).toHaveLength(3);
    expect((await as(ids.admin, 'select * from classes')).rows).toHaveLength(2);
  });
  it('admin cannot insert a row into another organization', async () => {
    await fails(ids.admin, `insert into subjects (organization_id,name) values ('${ids.org2}','Hacked')`);
  });
  it('composite FK blocks cross-tenant references', async () => {
    await db.exec(`insert into students (id,organization_id,student_code,full_name,current_school_grade)
      values ('60000000-0000-0000-0000-0000000000b2','${ids.org2}','X1','Other Org','5')`);
    await expect(db.exec(`insert into enrollments (organization_id,student_id,class_id,academic_year_id)
      values ('${ids.org1}','60000000-0000-0000-0000-0000000000b2','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001')`)).rejects.toThrow();
  });
});

describe('privilege escalation', () => {
  it('teacher cannot promote themselves', async () => {
    await as(ids.t1, `update organization_memberships set role = 'admin' where user_id = '${ids.t1}'`).catch(() => null); // denied (0 rows or error)
    const r = await as(ids.t1, `select role from organization_memberships where user_id = '${ids.t1}'`);
    expect(r.rows[0].role).toBe('teacher');
  });
  it('teacher cannot insert a membership', async () => {
    await fails(ids.t1, `insert into organization_memberships (organization_id,user_id,role,status) values ('${ids.org1}','${ids.t2}','admin','active')`);
  });
  it('teacher cannot change own account_status', async () => {
    await fails(ids.t1, `update profiles set account_status = 'disabled' where id = '${ids.t1}'`);
  });
  it('an admin (non-owner) cannot create another admin', async () => {
    await db.exec(`insert into auth.users (id,email) values ('10000000-0000-0000-0000-000000000009','m@x');
      insert into organization_memberships (organization_id,user_id,role,status) values ('${ids.org1}','10000000-0000-0000-0000-000000000009','admin','active')`);
    await fails('10000000-0000-0000-0000-000000000009',
      `insert into organization_memberships (organization_id,user_id,role,status) values ('${ids.org1}','${ids.t2}','admin','active') on conflict do nothing`);
    await fails('10000000-0000-0000-0000-000000000009', `update organization_memberships set role='admin' where user_id='${ids.t2}'`);
  });
  it('teacher cannot read audit logs', async () => {
    expect((await as(ids.t1, 'select * from audit_logs')).rows).toHaveLength(0);
  });
});

describe('class session workflow', () => {
  it('teacher creates a session with topics; duplicate submit is idempotent', async () => {
    const q = `select create_class_session('${A}', '2026-10-05', 'req-1', array['${FR}','${DEC}']::uuid[], 'intro') as id`;
    session = (await as(ids.t1, q)).rows[0].id;
    expect((await as(ids.t1, q)).rows[0].id).toBe(session);
    expect((await as(ids.t1, `select count(*)::int c from session_topics where class_session_id='${session}'`)).rows[0].c).toBe(2);
  });
  it("teacher cannot create a session for someone else's assignment", async () => {
    await fails(ids.t1, `select create_class_session('80000000-0000-0000-0000-000000000002','2026-10-05','req-x','{}','')`, /not authorised/);
  });
  it('rejects a topic from another subject', async () => {
    await fails(ids.t1, `select set_session_topics('${session}', array['${NOUN}']::uuid[], '')`, /does not belong to the subject/);
  });
  it('other teacher cannot see or write the session', async () => {
    expect((await as(ids.t2, 'select * from class_sessions')).rows).toHaveLength(0);
    await fails(ids.t2, `select save_attendance('${session}', '[{"student_id":"${S1}","status":"present"}]')`);
  });
  it('records attendance (upsert, no duplicates)', async () => {
    const rec = `'[{"student_id":"${S1}","status":"present"},{"student_id":"${S2}","status":"absent"}]'`;
    await as(ids.t1, `select save_attendance('${session}', ${rec})`);
    await as(ids.t1, `select save_attendance('${session}', ${rec})`);
    expect((await as(ids.t1, 'select count(*)::int c from attendance_records')).rows[0].c).toBe(2);
  });
  it('cannot record attendance for a student from another class', async () => {
    await fails(ids.t1, `select save_attendance('${session}', '[{"student_id":"60000000-0000-0000-0000-000000000003","status":"present"}]')`, /not enrolled/);
  });
  it('refuses to assess an absent student', async () => {
    await fails(ids.t1, `select save_assessment_results('${session}', '[{"student_id":"${S2}","topic_id":"${FR}","outcome":"understood"}]')`, /absent|attendance/);
  });
  it('rejects an invalid outcome value', async () => {
    await fails(ids.t1, `select save_assessment_results('${session}', '[{"student_id":"${S1}","topic_id":"${FR}","outcome":"great"}]')`);
  });
  it('saves independent outcomes per topic', async () => {
    await as(ids.t1, `select save_assessment_results('${session}', '[{"student_id":"${S1}","topic_id":"${FR}","outcome":"understood"},{"student_id":"${S1}","topic_id":"${DEC}","outcome":"didnt_understand"}]')`);
    const r = await as(ids.t1, `select topic_id, outcome from assessment_results order by outcome`);
    expect(r.rows.map((x: any) => x.outcome)).toEqual(['understood', 'didnt_understand']);
  });
  it('completion is blocked while outcomes are missing, then allowed', async () => {
    await as(ids.t1, `select save_attendance('${session}', '[{"student_id":"${S2}","status":"present"}]')`);
    await fails(ids.t1, `select complete_assessment('${session}')`, /1? ?.*outcome|incomplete/);
    await as(ids.t1, `select save_attendance('${session}', '[{"student_id":"${S2}","status":"absent"}]')`);
    await as(ids.t1, `select complete_assessment('${session}')`);   // S1 fully assessed, S2 absent => complete
    expect((await as(ids.t1, 'select status from assessments')).rows[0].status).toBe('completed');
  });
  it('correcting a completed assessment needs a reason and keeps history', async () => {
    const upd = (reason: string) => `select save_assessment_results('${session}', '[{"student_id":"${S1}","topic_id":"${DEC}","outcome":"needs_revision"}]', '${reason}')`;
    await fails(ids.t1, upd(''), /reason is required/);
    await as(ids.t1, upd('Misclicked'));
    const h = await as(ids.t1, 'select previous_outcome,new_outcome,change_reason from assessment_result_history');
    expect(h.rows).toEqual([{ previous_outcome: 'didnt_understand', new_outcome: 'needs_revision', change_reason: 'Misclicked' }]);
  });
  it('history and audit log are append-only, even for administrators', async () => {
    await fails(ids.admin, `delete from assessment_result_history`);
    await fails(ids.admin, `update audit_logs set action = 'x'`);
    await expect(db.exec(`update audit_logs set action = 'x'`)).rejects.toThrow(/append-only/);
  });
  it('cannot mark absent a student who already has results', async () => {
    await fails(ids.t1, `select save_attendance('${session}', '[{"student_id":"${S1}","status":"absent"}]')`, /already has assessment results/);
  });
  it('a topic with results cannot be removed from the session', async () => {
    await fails(ids.t1, `select set_session_topics('${session}', array['${FR}']::uuid[], '')`, /cannot be removed/);
  });
});

describe('deactivation & transfers', () => {
  it('audit trail captured enrollment/result changes for admin', async () => {
    expect((await as(ids.admin, 'select count(*)::int c from audit_logs')).rows[0].c).toBeGreaterThan(0);
  });
  it('transfer preserves the old enrollment and attendance history', async () => {
    await as(ids.admin, `select transfer_enrollment('70000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','2026-10-20')`);
    const e = await as(ids.admin, `select status from enrollments where student_id='${S1}' order by start_date`);
    expect(e.rows.map((x: any) => x.status)).toEqual(['transferred', 'active']);
    expect((await as(ids.admin, 'select count(*)::int c from attendance_records where student_id=$1', [S1])).rows[0].c).toBe(1);
  });
  it('a teacher cannot transfer students', async () => {
    await fails(ids.t1, `select transfer_enrollment('70000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','2026-10-20')`);
  });
  it('deactivated membership loses access immediately', async () => {
    await db.exec(`update organization_memberships set status='deactivated' where user_id='${ids.t1}'`);
    expect((await as(ids.t1, 'select * from class_sessions')).rows).toHaveLength(0);
    await fails(ids.t1, `select save_attendance('${session}', '[{"student_id":"${S1}","status":"present"}]')`);
  });
});

#!/usr/bin/env node
// DEVELOPMENT-ONLY seed: a fictional trust with 3 classes, 2 teachers and ~20 fictional students.
// Refuses to run unless APP_ENV=development and SEED_PASSWORD is set. Never deletes anything; skips if the demo org exists.
//   APP_ENV=development SEED_PASSWORD='choose-a-long-dev-password' node supabase/seed/seed.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, pw = process.env.SEED_PASSWORD;
if (process.env.APP_ENV !== 'development') { console.error('Refusing to seed: APP_ENV must be exactly "development".'); process.exit(1); }
if (!url || !key || !pw) { console.error('Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_PASSWORD.'); process.exit(1); }
if (!/localhost|127\.0\.0\.1|\.supabase\.co/.test(url) || process.argv.includes('--production')) { console.error('Unexpected Supabase URL.'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });
const must = async (p) => { const { data, error } = await p; if (error) { console.error(error.message); process.exit(1); } return data; };

if ((await sb.from('organizations').select('id').eq('slug', 'demo-trust').maybeSingle()).data) { console.log('demo-trust already exists; nothing to do.'); process.exit(0); }
const org = await must(sb.from('organizations').insert({ name: 'Demo Tuition Trust (fictional)', slug: 'demo-trust', timezone: 'Asia/Kolkata' }).select('id').single());

async function user(email, name, role) {
  const { data, error } = await sb.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { display_name: name } });
  if (error) { console.error(email, error.message); process.exit(1); }
  await must(sb.from('organization_memberships').insert({ organization_id: org.id, user_id: data.user.id, role, status: 'active' }));
  return data.user.id;
}
const admin = await user('admin@demo.invalid', 'Demo Admin', 'owner');
const t1 = await user('teacher1@demo.invalid', 'Meera Teacher', 'teacher');
const t2 = await user('teacher2@demo.invalid', 'Arun Teacher', 'teacher');

const year = await must(sb.from('academic_years').insert({ organization_id: org.id, name: '2026-27', start_date: '2026-06-01', end_date: '2027-05-31', status: 'active' }).select('id').single());
const classes = await must(sb.from('classes').insert([5, 6, 7].map((g) => ({ organization_id: org.id, academic_year_id: year.id, name: `Grade ${g}`, grade_level: String(g) }))).select('id, name'));
const subjects = await must(sb.from('subjects').insert([{ organization_id: org.id, name: 'Mathematics' }, { organization_id: org.id, name: 'English' }]).select('id, name'));
const sid = (n) => subjects.find((s) => s.name === n).id;
const topics = await must(sb.from('topics').insert([
  ['Mathematics', 'Fractions'], ['Mathematics', 'Decimals'], ['Mathematics', 'Geometry basics'], ['English', 'Nouns'], ['English', 'Verb tenses'],
].map(([s, n], i) => ({ organization_id: org.id, subject_id: sid(s), name: n, sequence_order: i }))).select('id, name, subject_id'));

const first = ['Asha', 'Ben', 'Chitra', 'Dev', 'Esha', 'Farid', 'Gita', 'Hari', 'Isha', 'Jay', 'Kavya', 'Leo', 'Mira', 'Nikhil', 'Oma', 'Pria', 'Quin', 'Ravi', 'Sana', 'Tarun'];
const students = await must(sb.from('students').insert(first.map((n, i) => ({ organization_id: org.id, student_code: `D-${String(i + 1).padStart(3, '0')}`, full_name: `${n} Example`, current_school_grade: String(5 + (i % 3)), joined_at: '2026-06-01' }))).select('id, student_code'));
const classFor = (i) => classes[i % 3];
const enrollments = await must(sb.from('enrollments').insert(students.map((s, i) => ({ organization_id: org.id, student_id: s.id, class_id: classFor(i).id, academic_year_id: year.id, start_date: '2026-06-01' }))).select('id, student_id, class_id'));

const asg = await must(sb.from('teaching_assignments').insert([
  { c: classes[0], s: 'Mathematics', t: t1 }, { c: classes[1], s: 'Mathematics', t: t1 }, { c: classes[0], s: 'English', t: t2 }, { c: classes[2], s: 'Mathematics', t: t2 },
].map((a) => ({ organization_id: org.id, class_id: a.c.id, subject_id: sid(a.s), teacher_user_id: a.t, academic_year_id: year.id, start_date: '2026-06-01' }))).select('id, class_id, subject_id, teacher_user_id'));

// deterministic pattern across 3 weekly sessions per assignment
const outcomes = ['didnt_understand', 'needs_revision', 'understood'];
let n = 0;
for (const a of asg) {
  const roster = enrollments.filter((e) => e.class_id === a.class_id);
  const tps = topics.filter((t) => t.subject_id === a.subject_id).slice(0, 2);
  for (const [w, date] of ['2026-10-05', '2026-10-12', '2026-10-19'].entries()) {
    const sess = await must(sb.from('class_sessions').insert({ organization_id: org.id, teaching_assignment_id: a.id, class_id: a.class_id, subject_id: a.subject_id, teacher_user_id: a.teacher_user_id, session_date: date, status: 'completed' }).select('id').single());
    const asmt = await must(sb.from('assessments').insert({ organization_id: org.id, class_session_id: sess.id, status: 'completed', created_by: a.teacher_user_id }).select('id').single());
    await must(sb.from('session_topics').insert(tps.map((t) => ({ organization_id: org.id, class_session_id: sess.id, topic_id: t.id }))));
    const att = roster.map((e, i) => ({ e, status: (i + w) % 7 === 0 ? 'absent' : (i + w) % 5 === 0 ? 'late' : 'present' }));
    await must(sb.from('attendance_records').insert(att.map(({ e, status }) => ({ organization_id: org.id, class_session_id: sess.id, student_id: e.student_id, enrollment_id: e.id, status, recorded_by: a.teacher_user_id }))));
    const res = att.filter((x) => x.status !== 'absent').flatMap(({ e }, i) => tps.map((t, k) => ({ organization_id: org.id, assessment_id: asmt.id, class_session_id: sess.id, student_id: e.student_id, topic_id: t.id, outcome: outcomes[Math.min(2, Math.max(0, w + ((i + k) % 2) - 1 + (i % 3 === 0 ? 0 : 1)))], recorded_by: a.teacher_user_id })));
    await must(sb.from('assessment_results').insert(res)); n += res.length;
  }
}
console.log(`Seeded demo-trust: ${students.length} fictional students, ${asg.length} assignments, ${n} assessment results.`);
console.log('Sign in as admin@demo.invalid / teacher1@demo.invalid / teacher2@demo.invalid with the SEED_PASSWORD you provided.');
void admin;

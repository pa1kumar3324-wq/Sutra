// Optional LIVE check against a real Supabase project (e.g. `supabase start`), through the real
// PostgREST + auth path. Skipped unless the variables below are present. Never point at production.
//   LIVE_SUPABASE_URL, LIVE_SUPABASE_ANON_KEY, LIVE_TEACHER_EMAIL, LIVE_TEACHER_PASSWORD, LIVE_OTHER_ORG_STUDENT_ID
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const e = process.env;
const live = e.LIVE_SUPABASE_URL && e.LIVE_SUPABASE_ANON_KEY && e.LIVE_TEACHER_EMAIL && e.LIVE_TEACHER_PASSWORD;

describe.skipIf(!live)('live RLS through the Supabase client', () => {
  it('anonymous client sees no students', async () => {
    const sb = createClient(e.LIVE_SUPABASE_URL!, e.LIVE_SUPABASE_ANON_KEY!);
    const { data } = await sb.from('students').select('id');
    expect(data ?? []).toHaveLength(0);
  });
  it('teacher cannot self-promote or read audit logs, and cannot see a foreign student', async () => {
    const sb = createClient(e.LIVE_SUPABASE_URL!, e.LIVE_SUPABASE_ANON_KEY!);
    const { data: auth } = await sb.auth.signInWithPassword({ email: e.LIVE_TEACHER_EMAIL!, password: e.LIVE_TEACHER_PASSWORD! });
    const me = auth.user!.id;
    await sb.from('organization_memberships').update({ role: 'admin' }).eq('user_id', me);
    const { data: m } = await sb.from('organization_memberships').select('role').eq('user_id', me).single();
    expect(m?.role).toBe('teacher');
    expect((await sb.from('audit_logs').select('id')).data ?? []).toHaveLength(0);
    if (e.LIVE_OTHER_ORG_STUDENT_ID) expect((await sb.from('students').select('id').eq('id', e.LIVE_OTHER_ORG_STUDENT_ID)).data ?? []).toHaveLength(0);
  });
});

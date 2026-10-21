#!/usr/bin/env node
// One-time, explicit bootstrap of a trust and its first owner. Run from a trusted machine.
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/bootstrap-org.mjs --org "Hope Tuition Trust" --slug hope --email owner@example.org --name "Owner Name" --timezone Asia/Kolkata
// The owner receives an invitation email and sets their own password. No default passwords exist.
import { createClient } from '@supabase/supabase-js';

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : undefined; };
const [org, slug, email, name, timezone] = [arg('org'), arg('slug'), arg('email'), arg('name'), arg('timezone') ?? 'UTC'];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, site = process.env.NEXT_PUBLIC_SITE_URL;
if (!org || !slug || !email || !name || !url || !key || !site) {
  console.error('Missing input. Required: --org --slug --email --name and env NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: existing } = await sb.from('organizations').select('id').eq('slug', slug).maybeSingle();
if (existing) { console.error(`Organization "${slug}" already exists. Nothing changed.`); process.exit(1); }

const { data: o, error: oe } = await sb.from('organizations').insert({ name: org, slug, timezone, contact_email: email }).select('id').single();
if (oe) { console.error('Could not create organization:', oe.message); process.exit(1); }

let userId; let status = 'active';
const { data: prof } = await sb.from('profiles').select('id').eq('email', email.toLowerCase()).maybeSingle();
if (prof) userId = prof.id;
else {
  const { data, error } = await sb.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/auth/callback?next=/accept-invitation`, data: { display_name: name } });
  if (error) { console.error('Invitation failed:', error.message); process.exit(1); }
  userId = data.user.id; status = 'invited';
}
const { error: me } = await sb.from('organization_memberships').insert({ organization_id: o.id, user_id: userId, role: 'owner', status });
if (me) { console.error('Could not create owner membership:', me.message); process.exit(1); }
console.log(`Created "${org}". Owner ${email} ${status === 'invited' ? 'has been emailed an invitation.' : 'was added (existing account).'}`);

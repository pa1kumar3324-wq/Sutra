# Deployment

## Prerequisites
Node 20+, a Supabase project per environment (dev, preview/staging, production), a Vercel project, Supabase CLI (optional).

## Supabase
1. Create the project. In **Auth → URL Configuration** set Site URL to your domain and add redirect URLs: `https://YOUR-DOMAIN/auth/callback`, `http://localhost:3000/auth/callback`, and your Vercel preview pattern.
2. Disable public sign-ups (**Auth → Providers → Email → "Allow new users to sign up" off**). Staff join by invitation only.
3. Apply migrations `0001`→`0003` in order (`supabase db push` or SQL editor).
4. Optionally enable MFA and set a strict password policy.

## Environment variables (Vercel → Settings)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (all environments);
`SUPABASE_SERVICE_ROLE_KEY` (Production/Preview, "Sensitive"). Use a **separate Supabase project** for previews. Never set `APP_ENV=development` in production.

## First administrator
Run once from a trusted machine with the production values exported:
`npm run bootstrap -- --org "Trust Name" --slug trust-slug --email owner@trust.org --name "Owner" --timezone Asia/Kolkata`
The owner gets an invitation email and sets their own password. Do not run the seed script against production.

## Release
Push to the main branch → Vercel builds (`npm run build`). Migrations are **not** run by deploys; apply them deliberately before the release that needs them, after a backup.

## Smoke test
`GET /api/health` → `{"status":"ok"}` (no secrets/data). Then: sign in as owner, create year/class/subject/topic/student, invite a teacher, accept the invite, run a session end to end, export a CSV, deactivate the teacher and confirm access is lost.

## Troubleshooting
- Redirect loops or invitation links failing → check Site URL / redirect URLs.
- "You do not have permission": RLS denied; check membership status and assignment is active.
- Failed saves: message shown in the board; server logs print only error codes. Check Supabase Logs (Postgres) for the code.
- Invitation email not arriving → Supabase default SMTP is rate-limited; configure custom SMTP.

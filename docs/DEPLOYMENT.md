# Deployment

## Prerequisites
Node 20+, a Supabase project per environment (dev, preview/staging, production), a Vercel project, Supabase CLI (optional).

## Supabase
1. Create the project. In **Auth â†’ URL Configuration** set Site URL to your domain and add redirect URLs. The app sends `.../auth/callback?next=/reset-password` (and `?next=/accept-invitation`), and Supabase compares the whole URL including the query string, so use wildcards: `https://YOUR-DOMAIN/auth/callback**`, `http://localhost:3000/auth/callback**`, and your Vercel preview pattern (e.g. `https://*-your-team.vercel.app/auth/callback**`). If the exact URL is not allowed, Supabase silently falls back to the Site URL and the recovery code is never exchanged. Set `NEXT_PUBLIC_SITE_URL` to the same public origin (not localhost) in each deployed environment.
   For recovery links that also work when opened in a different browser/device, change the **Reset Password** email template link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`.
   **Invite email (important):** change the **Invite user** template link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/accept-invitation`. The default `{{ .ConfirmationURL }}` delivers the session in the URL `#fragment`; the app now finishes that via `/auth/finish`, but the `token_hash` form is more reliable (works in any browser, survives email scanners that pre-open links less badly than fragments do).
2. Disable public sign-ups (**Auth â†’ Providers â†’ Email â†’ "Allow new users to sign up" off**). Staff join by invitation only.
3. Apply migrations `0001`â†’`0004` in order (`supabase db push` or SQL editor): `0001_schema.sql`, `0002_functions_triggers.sql`, `0003_rls.sql`, `0004_student_edit_guards.sql`. `0004` makes a student's `id` and `organization_id` immutable and is required for the student-edit feature to be safe; apply it before releasing the code that includes the edit page. Back up first.
4. Optionally enable MFA and set a strict password policy.

## Environment variables (Vercel â†’ Settings)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (all environments);
`SUPABASE_SERVICE_ROLE_KEY` (Production/Preview, "Sensitive"). Use a **separate Supabase project** for previews. Never set `APP_ENV=development` in production.

## First administrator
Run once from a trusted machine with the production values exported:
`npm run bootstrap -- --org "Trust Name" --slug trust-slug --email owner@trust.org --name "Owner" --timezone Asia/Kolkata`
The owner gets an invitation email and sets their own password. Do not run the seed script against production.

## Release
Push to the main branch â†’ Vercel builds (`npm run build`). Migrations are **not** run by deploys; apply them deliberately before the release that needs them, after a backup.

## Smoke test
`GET /api/health` â†’ `{"status":"ok"}` (no secrets/data). Then: sign in as owner, create year/class/subject/topic/student, invite a teacher, accept the invite, run a session end to end, export a CSV, deactivate the teacher and confirm access is lost.

## Troubleshooting
- Redirect loops or invitation links failing â†’ check Site URL / redirect URLs.
- "You do not have permission": RLS denied; check membership status and assignment is active.
- Failed saves: message shown in the board; server logs print only error codes. Check Supabase Logs (Postgres) for the code.
- Invitation email not arriving â†’ Supabase default SMTP is rate-limited; configure custom SMTP.
- **Signed in, then sent back to `/login` with a message.** The message names the cause (it used to be one misleading sentence):
  "Your session has ended" = no valid session (authentication); "We couldn't check your access just now" = Auth/database error, not a permission problem;
  "Your invitation has not been accepted yet" (you land on `/accept-invitation`) = membership still `invited`, e.g. after using password reset instead of the invitation link; "deactivated" / "not linked to a trust" = membership `deactivated` / absent.
  Start the dev server with `AUTH_DIAGNOSTICS=1` (on by default in `next dev`) and read the `[auth-diag]` lines (error codes, counts and membership status/role only; no tokens, cookies, passwords, e-mails or ids).
  For one account, run the read-only checker locally: `node --env-file=.env.local scripts/diagnose-login.mjs --email you@example.org` (prints which Supabase project the app uses, whether the keys match it, and the membership status; prints no secrets, changes nothing).
- **`__webpack_modules__[moduleId] is not a function`** in `next dev`: a stale/corrupt `.next` cache (typically after replacing source files while the dev server runs). Stop the server, delete `.next`, restart. It is unrelated to authentication.
- Changes to `.env.local` need a dev-server restart (middleware and server code read the same variables only at start-up).

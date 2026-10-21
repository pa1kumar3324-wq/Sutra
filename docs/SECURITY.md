# Security

## Model
Authorization is enforced in Postgres (RLS + triggers) and again in server code. UI hiding is cosmetic.
| Role | Can |
|---|---|
| owner/admin | manage everything in own org; only owner manages admins/owners; cannot change own membership |
| teacher | read own assignments, classes taught, enrolled students; create/modify only own sessions' attendance, outcomes, notes |
| coordinator/auditor | read-only (schema level) |
| anon | nothing |

## Controls
- Organization resolved from validated active membership; composite FKs and RLS block cross-tenant reads/writes.
- Service-role key only in `lib/supabase/admin.ts` (`server-only`), scripts, never in the client bundle; build fails if it is imported client-side.
- Login errors are uniform; password reset reveals nothing about account existence; `next` redirects accept same-site paths only.
- Invitations: Supabase one-time links; membership starts `invited` and is activated only for the authenticated invitee. Only owners may invite admins.
- Deactivation revokes access on the next query (policies check status each time).
- Audit log (append-only) for membership, enrolment, assignment, class, subject, student status, attendance/outcome corrections and exports. Contains whitelisted non-personal fields only; no notes, no secrets.
- CSV export: same RLS as the UI, audited, formula-injection neutralised, range-limited.
- Headers: `X-Frame-Options: DENY`, `nosniff`, referrer policy, `no-store`.

## Threat tests
Covered by `tests/integration/migrations.test.ts` (run against real Postgres semantics): anonymous access; teacher cross-class and cross-org reads; foreign assignment/session; self-promotion; membership insert; admin creating admin; unauthorized writes to another org; absent-student assessment; correction without reason; tampering with history/audit; deactivated membership reuse.
Server-action and route-level checks (URL tampering, export scope) rely on RLS and are covered by the optional live test and e2e.

## Known limitations
- The route/server-action layer and PostgREST embeds are not exercised against a live Supabase in this repository's CI; run `test:rls` and e2e against a dev project before launch.
- No rate limiting beyond Supabase Auth's; consider Vercel/WAF rules. No MFA configured (enable in Supabase Auth for admins).
- Admin user listing shows emails; restrict admin accounts accordingly.
- Data subject deletion is manual (see DATABASE.md).

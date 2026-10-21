# Testing

| Command | What | Needs |
|---|---|---|
| `npm test` | Unit: outcomes, absence rules, completion rules, session lifecycle, attendance %, revision rules, distributions, CSV injection, Zod schemas | nothing |
| `npm run test:db` | Runs all migrations in PGlite with a stubbed `auth` schema; ~30 tests: tenant isolation, role scoping, privilege escalation, idempotent sessions, topic/subject, attendance rules, absent not assessable, completion, corrections + history, append-only, transfers keep history, deactivation | nothing |
| `npm run test:rls` | Live RLS via supabase-js | dev Supabase + `LIVE_*` env |
| `npm run test:e2e` | Playwright: anonymous redirects; full teacher assessment flow persisting across reload; teacher blocked from admin | running app + seeded dev project + `E2E_*` env |
| `npm run lint`, `npm run typecheck`, `npm run build` | static checks and production build | `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` placeholders are enough to build |

PGlite is Postgres compiled to WASM, so SQL semantics are real, but Supabase-specific pieces (PostgREST, GoTrue, `auth.uid()` from JWT) are emulated.
Not yet covered by automated tests: admin CRUD flows, CSV route authorization over HTTP, invitation acceptance, the 22-step admin→teacher→report e2e scenario (only the teacher assessment portion is scripted).

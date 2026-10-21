# Tuition Tracker

Student tracking for a charitable tuition trust. After every class a teacher records attendance and, for each
present student and each topic taught, one of three outcomes: **Understood**, **Needs Revision**, **Didn't Understand**.
History is kept, so progress over time is visible. Multi-tenant from day one (one trust today, more later).

**Stack:** Next.js 14 (App Router) · React 18 · TypeScript (strict) · Tailwind · Supabase (Postgres, Auth, RLS) · Zod · Recharts · Vitest · Playwright. Deploy on Vercel + Supabase.

## Features
- Roles: owner/admin and teacher (coordinator/auditor are in the schema for later). Enforced by Postgres RLS **and** server code.
- Admin: students (search, filters, pagination), classes, subjects, topics, academic years, teachers (invite / deactivate), assignments, enrolment transfer/end, sessions overview, reports, CSV export, audit log, settings.
- Teacher: dashboard of what needs attention, class pages, start a session, pick topics, attendance (touch-friendly, "Mark all present" is an explicit action), assessment cards, student progress profile, reports.
- Assessment: per student × per topic, autosave + explicit save, save confirmed only after the database responds, resume later, completion rules, corrections with reason and append-only history. Absent students are never assessed and never get an outcome by default.
- Progress: transparent revision rules (see `docs/PRODUCT_SPEC.md`), no numeric scores.

## Quick start
```bash
npm install
cp .env.example .env.local        # fill in your Supabase project values
# apply supabase/migrations/*.sql in order (see docs/DATABASE.md), then:
npm run bootstrap -- --org "Your Trust" --slug your-trust --email owner@example.org --name "Owner Name" --timezone Asia/Kolkata
npm run dev
```
Dev data (optional, fictional, dev only): `APP_ENV=development SEED_PASSWORD='long-dev-password' npm run seed:dev`.

## Commands
| | |
|---|---|
| `npm run dev` / `build` / `start` | run / build / serve |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | unit tests (domain rules, validation, CSV) |
| `npm run test:db` | migrations + RLS + triggers in an in-memory Postgres (PGlite), no Docker |
| `npm run test:rls` | optional live RLS checks against a dev Supabase project |
| `npm run test:e2e` | Playwright (needs a running app and a seeded dev project) |

## Environment variables
See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is server-only (invitations, bootstrap, seed). Never prefix it with `NEXT_PUBLIC_`.

## Docs
`docs/PRODUCT_SPEC.md` · `ARCHITECTURE.md` · `DATABASE.md` · `SECURITY.md` · `DEPLOYMENT.md` · `TESTING.md`

# Architecture

- **Next.js App Router**, Server Components by default. Client components only where interaction needs them: `AttendanceBoard`, `AssessmentBoard`, `OutcomeChart`.
- **Supabase clients**: `lib/supabase/server.ts` (request-scoped, acts as the user, RLS applies), `lib/supabase/middleware.ts` (session refresh + route guard),
  `lib/supabase/admin.ts` (service role, `server-only`, used for staff invitations and activating the caller's own invited membership). No browser Supabase client exists.
- **Auth flow**: email+password → Supabase Auth cookies → middleware validates the JWT with `auth.getUser()` on every request. Invite and reset emails go through `/auth/callback` (PKCE code exchange) then `/accept-invitation` or `/reset-password`.
- **Tenant context**: `getContext()` resolves the organization only from the caller's own active membership (read through RLS). No organization id is ever taken from a request. Role guards: `requireAdmin`, `requireTeacher`.
- **Layers**: `lib/domain` (pure rules, unit-tested) · `lib/validations` (Zod) · `lib/actions` (server actions: validate → authorize → call DB) · `lib/reports.ts` / `lib/session-data.ts` (read queries) · `supabase/migrations` (the final enforcement layer).
- **Mutations**: forms post to server actions and redirect with a flash message; the board components call server actions directly and show success only after the action returns `ok`.
- **Multi-record writes** go through SECURITY INVOKER RPCs (`create_class_session`, `save_attendance`, `save_assessment_results`, `complete_assessment`, `transfer_enrollment`) so each is one transaction and RLS + triggers still apply.
- **Caching**: responses are `private, no-store`; no cross-user caches. `getContext` is memoized per request only.
- **Types**: Supabase rows are read with narrow local types. Generate full types with `supabase gen types typescript` and adopt them incrementally (known gap).

/**
 * Temporary, server-side-only diagnostics for the sign-in -> session -> membership path.
 *
 * Safe by construction: callers cannot pass free-form text. Only the whitelisted fields below are ever written, and
 * they carry error CODES (never messages), booleans, counts, membership status/role labels, a pathname without its
 * query string, and the Supabase project host (public; it is already in every browser bundle).
 * Never written: passwords, access/refresh tokens, cookie names or values, API keys, e-mail addresses, user ids.
 *
 * Enabled when AUTH_DIAGNOSTICS=1 or in `next dev`. Remove (or leave disabled) once the issue is closed.
 */
export type AuthStage =
  | 'middleware_no_user'    // middleware could not validate a user on a protected path
  | 'login_signin'          // signInWithPassword returned an error
  | 'login_ok'              // signInWithPassword succeeded (records whether session cookies were set)
  | 'ctx_get_user'          // getUser() in requireContext found no user (or Auth was unreachable)
  | 'ctx_memberships'       // the active-membership query failed (database / PostgREST / network)
  | 'ctx_membership_lookup' // diagnostic follow-up: what membership rows exist for this user, if not active
  | 'ctx_denied'            // final decision that sent the person away from a protected page
  | 'callback_entry'        // /auth/callback reached: which credential shapes arrived (booleans only, never values)
  | 'callback_provider_error' // the link itself carried ?error/error_code (code is a short Supabase identifier)
  | 'callback_exchange'     // exchangeCodeForSession result (PKCE ?code=)
  | 'callback_verify'       // verifyOtp result (?token_hash=&type=)
  | 'callback_no_credentials' // neither code nor token_hash+type: e.g. implicit-flow link whose tokens are in the #fragment (never sent to a server)
  | 'callback_fragment'    // /auth/finish: setSession() from #fragment tokens (implicit-flow link)
  | 'invite_get_user'       // accept-invitation: getUser() (session retrieval)
  | 'invite_pending_lookup' // accept-invitation: caller's own 'invited' membership rows, read through RLS BEFORE touching the password
  | 'invite_update_password'// accept-invitation: supabase.auth.updateUser({ password })
  | 'invite_activate'       // accept-invitation: service-role activation of the caller's own invited memberships
  | 'invite_done';          // accept-invitation: everything succeeded

export type AuthDiag = {
  code?: string | number | null;
  status?: number | null;
  hasUser?: boolean;
  hasSessionCookie?: boolean;
  sessionCookieCount?: number;
  activeMemberships?: number;
  memberships?: { status: string; role: string }[];
  profileAccountStatus?: string | null;
  reason?: string;
  path?: string;
  /** Link/credential shape booleans for /auth/callback (e.g. { code: true, tokenHash: false, type: 'invite' }). Never values. */
  link?: { hasCode?: boolean; hasTokenHash?: boolean; type?: string | null; hasNext?: boolean };
  pendingInvites?: number;
  activated?: number;
};

/** Error CODE only. Never `.message`, which can echo request details. */
export const errCode = (e: { code?: unknown; name?: unknown; status?: unknown } | null | undefined): string | null =>
  e ? String(e.code ?? e.name ?? e.status ?? 'unknown').slice(0, 64) : null;

/** Short identifier-like labels only (error codes, link types); anything else is dropped so free text can never leak. */
export const safeLabel = (v: string): string => (/^[A-Za-z0-9_.-]{1,64}$/.test(v) ? v : 'invalid-label');

const enabled = () => process.env.AUTH_DIAGNOSTICS === '1' || process.env.NODE_ENV === 'development';
const host = () => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname; } catch { return 'invalid-or-missing-NEXT_PUBLIC_SUPABASE_URL'; } };

export function authDiag(stage: AuthStage, f: AuthDiag = {}) {
  if (!enabled()) return;
  const safe = {
    stage,
    supabaseHost: host(),
    code: f.code ?? undefined, status: f.status ?? undefined,
    hasUser: f.hasUser, hasSessionCookie: f.hasSessionCookie, sessionCookieCount: f.sessionCookieCount,
    activeMemberships: f.activeMemberships,
    memberships: f.memberships?.slice(0, 10).map((m) => ({ status: String(m.status), role: String(m.role) })),
    profileAccountStatus: f.profileAccountStatus ?? undefined,
    reason: f.reason,
    path: f.path ? f.path.split('?')[0].split('#')[0].slice(0, 120) : undefined,
    link: f.link ? { hasCode: f.link.hasCode, hasTokenHash: f.link.hasTokenHash, type: f.link.type == null ? f.link.type : safeLabel(f.link.type), hasNext: f.link.hasNext } : undefined,
    pendingInvites: f.pendingInvites, activated: f.activated,
  };
  console.warn('[auth-diag] ' + JSON.stringify(safe));
}

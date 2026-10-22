import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { LINK_EXPIRED, safeNext } from '@/lib/auth/recovery';
import { authDiag, errCode, safeLabel } from '@/lib/auth/diagnostics';

/**
 * Landing point for emailed links (password recovery, staff invitations).
 * Supports both Supabase flows:
 *  - PKCE:        ?code=...                      (needs the code-verifier cookie from the browser that requested it)
 *  - token hash:  ?token_hash=...&type=recovery  (works in any browser/device; use this in the email template)
 *  - implicit:    #access_token=...&refresh_token=... (fragment; handed to /auth/finish, which completes it client-side)
 * Supabase reports failures (e.g. otp_expired) as ?error=...&error_code=... on this URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get('next'));
  const failTo = next === '/reset-password' ? '/forgot-password' : '/login';
  const fail = () => NextResponse.redirect(`${origin}${failTo}?error=${encodeURIComponent(LINK_EXPIRED)}`);

  const sbCookies = () => { try { return cookies().getAll().filter((c) => c.name.startsWith('sb-')).length; } catch { return 0; } };
  authDiag('callback_entry', { path: '/auth/callback', link: { hasCode: !!searchParams.get('code'), hasTokenHash: !!searchParams.get('token_hash'), type: searchParams.get('type'), hasNext: !!searchParams.get('next') } });

  if (searchParams.get('error') || searchParams.get('error_code')) {
    authDiag('callback_provider_error', { code: safeLabel(searchParams.get('error_code') ?? searchParams.get('error') ?? 'unknown') });
    return fail();
  }

  const supabase = createClient();
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  // Only the link types this app sends are accepted; anything else is treated as an invalid link.
  const rawType = searchParams.get('type');
  const type = rawType === 'recovery' || rawType === 'invite' ? (rawType as EmailOtpType) : null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    authDiag('callback_exchange', { code: errCode(error), status: error?.status ?? null, hasUser: !!data?.user, sessionCookieCount: sbCookies() });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error('exchangeCodeForSession failed', error.code ?? error.status);
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    authDiag('callback_verify', { code: errCode(error), status: error?.status ?? null, hasUser: !!data?.user, hasSessionCookie: !!data?.session, sessionCookieCount: sbCookies(), link: { type } });
    if (!error) return NextResponse.redirect(`${origin}${type === 'recovery' ? '/reset-password' : next}`);
    console.error('verifyOtp failed', error.code ?? error.status);
  } else {
    // e.g. an implicit-flow invite link: its tokens live in the URL #fragment, which browsers never send to the server.
    // Hand off to /auth/finish, a client page that can read the fragment. Browsers keep the original #fragment across
    // a same-origin redirect, so the tokens reach that page without ever being sent to (or logged by) the server.
    authDiag('callback_no_credentials', { reason: 'no_code_or_token_hash_with_valid_type' });
    if (tokenHash) return fail();   // a token_hash with an unsupported type is a bad link, not a fragment link
    return NextResponse.redirect(`${origin}/auth/finish?next=${encodeURIComponent(next)}`);
  }
  return fail();
}

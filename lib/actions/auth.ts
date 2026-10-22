'use server';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { flash, formObject } from './helpers';
import { invitationPasswordMessage, passwordUpdateMessage, safeNext } from '@/lib/auth/recovery';
import { authDiag, errCode } from '@/lib/auth/diagnostics';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || `https://${headers().get('host')}`;
const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(128);

export async function login(fd: FormData) {
  const v = formObject(fd);
  const email = emailSchema.safeParse(v.email);
  if (!email.success || !v.password) flash('/login', 'error', 'Enter your email and password.');
  const supabase = createClient();
  const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email: email.data!, password: v.password });
  if (error) {
    authDiag('login_signin', { code: errCode(error), status: error.status ?? null });   // code only, never the message/credentials
    flash('/login', 'error', 'Email or password is incorrect.');                         // same message for every failure
  }
  // Evidence that the session cookies were set on this response BEFORE we redirect (count only; names/values are never logged).
  authDiag('login_ok', { hasUser: !!signedIn?.user, sessionCookieCount: cookies().getAll().filter((c) => c.name.startsWith('sb-')).length });
  const next = safeNext(v.next);
  redirect(next);
}

export async function logout() {
  await createClient().auth.signOut();
  redirect('/login');
}

export async function forgotPassword(fd: FormData) {
  const email = emailSchema.safeParse(formObject(fd).email);
  if (email.success) {
    const { error } = await createClient().auth.resetPasswordForEmail(email.data, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
    // Never reveal to the visitor whether the account exists, but do surface delivery/config failures to the operator.
    if (error) console.error('resetPasswordForEmail failed', error.code ?? error.status);
  }
  flash('/forgot-password', 'ok', 'If that email has an account, a reset link is on its way.');
}

export async function resetPassword(fd: FormData) {
  const v = formObject(fd);
  const pw = passwordSchema.safeParse(v.password);
  if (!pw.success) flash('/reset-password', 'error', pw.error.issues[0].message);
  if (v.password !== v.confirm) flash('/reset-password', 'error', 'Passwords do not match.');
  const supabase = createClient();
  // A password may only be changed from a valid recovery (or signed-in) session. Verify with Supabase Auth first.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) flash('/forgot-password', 'error', passwordUpdateMessage({ name: 'AuthSessionMissingError' }));
  const { data, error } = await supabase.auth.updateUser({ password: v.password });
  if (error) {
    console.error('updateUser(password) failed', error.code ?? error.status);   // code only: no tokens, no password
    if (passwordUpdateMessage(error).startsWith('That reset link')) flash('/forgot-password', 'error', passwordUpdateMessage(error));
    flash('/reset-password', 'error', passwordUpdateMessage(error));
  }
  if (!data?.user) flash('/reset-password', 'error', passwordUpdateMessage(null));
  // End the recovery session (on every device) so the person signs in again with the NEW password.
  // This also proves the update persisted, and invalidates anything an attacker may have held.
  await supabase.auth.signOut({ scope: 'global' });
  flash('/login', 'ok', 'Password updated. Sign in with your new password.');
}

/**
 * Invited staff set a password; their own `invited` memberships are then activated.
 * Order (each step must succeed before the next):
 *   1. getUser()                         identity of the caller, validated by Supabase Auth
 *   2. input validation                  nothing touches Supabase Auth with a bad/mismatched password
 *   3. own `invited` rows via RLS        no pending invitation -> the password is NOT changed
 *   4. updateUser({ password })          real Supabase error code preserved
 *   5. service-role activation           filtered by the verified user id AND status = 'invited'
 */
export async function acceptInvitation(fd: FormData) {
  const v = formObject(fd);
  const supabase = createClient();
  const sbCookies = () => cookies().getAll().filter((c) => c.name.startsWith('sb-')).length;

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  authDiag('invite_get_user', { code: errCode(userErr), status: userErr?.status ?? null, hasUser: !!user, sessionCookieCount: sbCookies() });
  if (!user) flash('/login', 'error', 'This invitation link is invalid or has expired. Ask your administrator to resend it.');

  const pw = passwordSchema.safeParse(v.password);
  if (!pw.success) flash('/accept-invitation', 'error', pw.error.issues[0].message);
  if (v.password !== v.confirm) flash('/accept-invitation', 'error', 'Passwords do not match.');

  // Read through RLS (member_select_self): the caller can see only their own rows.
  const { data: pending, error: pendErr } = await supabase.from('organization_memberships').select('id').eq('user_id', user!.id).eq('status', 'invited');
  authDiag('invite_pending_lookup', { code: errCode(pendErr), hasUser: true, pendingInvites: pending?.length ?? 0 });
  if (pendErr) flash('/accept-invitation', 'error', "We couldn't check your invitation just now. Try again in a moment.");
  if (!pending || pending.length === 0) flash('/login', 'error', 'No pending invitation was found for this account.');

  const { error } = await supabase.auth.updateUser({ password: v.password });
  authDiag('invite_update_password', { code: errCode(error), status: error?.status ?? null, hasUser: true, sessionCookieCount: sbCookies() });
  if (error) flash('/accept-invitation', 'error', invitationPasswordMessage(error));

  // service role used narrowly: only the verified caller's own invited memberships, only after the password update succeeded
  const { data: act, error: actErr } = await createAdminClient().from('organization_memberships')
    .update({ status: 'active' }).eq('user_id', user!.id).eq('status', 'invited').select('id');
  authDiag('invite_activate', { code: errCode(actErr), hasUser: true, activated: act?.length ?? 0 });
  if (actErr) flash('/accept-invitation', 'error', 'Your password was set, but we could not activate your access. Try again or contact your administrator.');
  if (!act || act.length === 0) flash('/login', 'error', 'No pending invitation was found for this account.');
  authDiag('invite_done', { hasUser: true, activated: act.length });
  redirect('/');
}

/**
 * Completes an implicit-flow email link (invite / recovery): Supabase puts the tokens in the URL #fragment, which only
 * the browser can read, so /auth/finish posts them here. setSession() validates them with Supabase Auth and writes the
 * session cookies; on any failure nothing is assumed and the page shows the expired-link message. Tokens are never logged.
 */
export async function completeFragmentSession(
  accessToken: string,
  refreshToken: string,
  nextRaw: string
): Promise<{ ok: true; redirectTo: string } | { ok: false }> {
  const next = safeNext(nextRaw);
  const okShape = (t: unknown) =>
    typeof t === 'string' && t.length > 10 && t.length < 4096;

  if (!okShape(accessToken) || !okShape(refreshToken)) {
    return { ok: false };
  }

  const { data, error } = await createClient().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  authDiag('callback_fragment', {
    code: errCode(error),
    status: error?.status ?? null,
    hasUser: !!data?.user,
    hasSessionCookie: !!data?.session,
  });

  if (error || !data?.session) return { ok: false };

  return { ok: true, redirectTo: next };
}

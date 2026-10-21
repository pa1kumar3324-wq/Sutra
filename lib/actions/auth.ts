'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { flash, formObject } from './helpers';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || `https://${headers().get('host')}`;
const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(128);

export async function login(fd: FormData) {
  const v = formObject(fd);
  const email = emailSchema.safeParse(v.email);
  if (!email.success || !v.password) flash('/login', 'error', 'Enter your email and password.');
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data!, password: v.password });
  if (error) flash('/login', 'error', 'Email or password is incorrect.');   // same message for every failure
  const next = v.next && v.next.startsWith('/') && !v.next.startsWith('//') ? v.next : '/';
  redirect(next);
}

export async function logout() {
  await createClient().auth.signOut();
  redirect('/login');
}

export async function forgotPassword(fd: FormData) {
  const email = emailSchema.safeParse(formObject(fd).email);
  if (email.success) {
    await createClient().auth.resetPasswordForEmail(email.data, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
  }
  // identical response whether or not the account exists
  flash('/forgot-password', 'ok', 'If that email has an account, a reset link is on its way.');
}

export async function resetPassword(fd: FormData) {
  const v = formObject(fd);
  const pw = passwordSchema.safeParse(v.password);
  if (!pw.success) flash('/reset-password', 'error', pw.error.issues[0].message);
  if (v.password !== v.confirm) flash('/reset-password', 'error', 'Passwords do not match.');
  const { error } = await createClient().auth.updateUser({ password: v.password });
  if (error) flash('/reset-password', 'error', 'The reset link has expired. Request a new one.');
  flash('/', 'ok', 'Password updated.');
}

/** Invited staff set a password; their own `invited` memberships are then activated. */
export async function acceptInvitation(fd: FormData) {
  const v = formObject(fd);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) flash('/login', 'error', 'This invitation link is invalid or has expired. Ask your administrator to resend it.');
  const pw = passwordSchema.safeParse(v.password);
  if (!pw.success) flash('/accept-invitation', 'error', pw.error.issues[0].message);
  if (v.password !== v.confirm) flash('/accept-invitation', 'error', 'Passwords do not match.');
  const { error } = await supabase.auth.updateUser({ password: v.password });
  if (error) flash('/accept-invitation', 'error', 'Could not set the password. Try the link again.');
  // service role used narrowly: only the authenticated caller's own invited memberships
  const { data: act } = await createAdminClient().from('organization_memberships')
    .update({ status: 'active' }).eq('user_id', user!.id).eq('status', 'invited').select('id');
  if (!act || act.length === 0) flash('/login', 'error', 'No pending invitation was found for this account.');
  redirect('/');
}

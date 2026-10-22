// Regression tests for the recovery callback and the reset action, with Supabase mocked (no network, no secrets).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const auth = {
  exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn(), setSession: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(),
};
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ auth }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('service role must not be used by reset flow'); } }));
vi.mock('next/headers', () => ({ headers: () => new Headers({ host: 'app.test' }) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('REDIRECT:' + url); } }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/callback/route';
import { resetPassword, completeFragmentSession } from '@/lib/actions/auth';
import { LINK_EXPIRED } from '@/lib/auth/recovery';

const call = (qs: string) => GET(new NextRequest('https://app.test/auth/callback?' + qs));
const loc = (r: Response) => new URL(r.headers.get('location')!);
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const redirected = async (p: Promise<unknown>) => { try { await p; } catch (e: any) { return String(e.message).replace('REDIRECT:', ''); } throw new Error('expected redirect'); };

beforeEach(() => { Object.values(auth).forEach((f) => f.mockReset()); });

describe('/auth/callback', () => {
  it('PKCE code: exchanges and continues to /reset-password', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const r = await call('code=abc&next=/reset-password');
    expect(loc(r).pathname).toBe('/reset-password');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });
  it('token_hash + recovery: verifies and always lands on /reset-password', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const r = await call('token_hash=h&type=recovery&next=//evil.com');
    expect(loc(r).pathname).toBe('/reset-password');
    expect(loc(r).host).toBe('app.test');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'h' });
  });
  it('invalid / expired / reused recovery link -> /forgot-password with message, no session assumed', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { code: 'flow_state_not_found' } });
    auth.verifyOtp.mockResolvedValue({ error: { code: 'otp_expired' } });
    for (const qs of ['code=bad&next=/reset-password', 'token_hash=bad&type=recovery&next=/reset-password', 'error=access_denied&error_code=otp_expired&next=/reset-password']) {
      const r = await call(qs);
      expect(loc(r).pathname).toBe('/forgot-password');
      expect(loc(r).searchParams.get('error')).toBe(LINK_EXPIRED);
    }
  });
  it('failed invitation links still go to /login; unknown link types are rejected; open redirects are neutralised', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { code: 'x' } });
    expect(loc(await call('code=bad&next=/accept-invitation')).pathname).toBe('/login');
    expect(loc(await call('token_hash=h&type=magiclink&next=/')).pathname).toBe('/login');
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(loc(await call('code=ok&next=https://evil.com')).pathname).toBe('/');
  });
});

describe('resetPassword action', () => {
  const good = { password: 'correct horse battery', confirm: 'correct horse battery' };
  it('success: updates, ends ALL sessions, sends to /login with confirmation', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    auth.updateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    const to = await redirected(resetPassword(fd(good)));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: good.password });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(to.startsWith('/login?ok=')).toBe(true);
    expect(auth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(auth.signOut.mock.invocationCallOrder[0]);
  });
  it('no recovery session: never calls updateUser; explains and offers a new link', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    const to = await redirected(resetPassword(fd(good)));
    expect(to.startsWith('/forgot-password?error=')).toBe(true);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('rejected update shows the real cause and keeps the session (no sign-out, no false success)', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    auth.updateUser.mockResolvedValue({ data: { user: null }, error: { code: 'same_password', status: 422 } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const to = await redirected(resetPassword(fd(good)));
    expect(to.startsWith('/reset-password?error=')).toBe(true);
    expect(decodeURIComponent(to)).toMatch(/different/);
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain(good.password);   // passwords are never logged
    spy.mockRestore();
  });
  it('mismatched or short passwords never reach Supabase', async () => {
    expect(await redirected(resetPassword(fd({ password: 'correct horse battery', confirm: 'nope nope nope' })))).toMatch(/^\/reset-password\?error=/);
    expect(await redirected(resetPassword(fd({ password: 'short', confirm: 'short' })))).toMatch(/^\/reset-password\?error=/);
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe('/auth/callback invitation diagnostics', () => {
  it('invite token_hash: verifies as type=invite and continues to ?next (session established by the callback)', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' }, session: {} }, error: null });
    const r = await call('token_hash=h&type=invite&next=/accept-invitation');
    expect(loc(r).pathname).toBe('/accept-invitation');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: 'invite', token_hash: 'h' });
  });
  it('implicit-flow link (tokens only in the #fragment) reaches the server with no credential: logged distinctly, then handed to /auth/finish with ?next kept', async () => {
    process.env.AUTH_DIAGNOSTICS = '1';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await call('next=/accept-invitation');
    expect(loc(r).pathname).toBe('/auth/finish');
    expect(loc(r).searchParams.get('next')).toBe('/accept-invitation');
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    const stages = warn.mock.calls.map((c) => JSON.parse(String(c[0]).slice(12)).stage);
    expect(stages).toEqual(['callback_entry', 'callback_no_credentials']);
    warn.mockRestore(); delete process.env.AUTH_DIAGNOSTICS;
  });
  it('implicit-flow recovery link is also handed to /auth/finish (which sends failures to /forgot-password)', async () => {
    expect(loc(await call('next=/reset-password')).pathname).toBe('/auth/finish');
  });
  it('callback diagnostics log codes/booleans only, never the token or code values', async () => {
    process.env.AUTH_DIAGNOSTICS = '1';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    auth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { code: 'otp_expired', status: 403 } });
    await call('token_hash=SECRET-HASH-VALUE&type=invite&next=/accept-invitation');
    const all = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(all).toContain('otp_expired');
    expect(all).not.toContain('SECRET-HASH-VALUE');
    warn.mockRestore(); delete process.env.AUTH_DIAGNOSTICS;
  });
});

describe('completeFragmentSession (implicit-flow invite/recovery links)', () => {
  const T = 'a'.repeat(40);
  it('valid tokens: sets the session and continues to ?next', async () => {
    auth.setSession.mockResolvedValue({ data: { user: { id: 'u1' }, session: {} }, error: null });
    expect(await completeFragmentSession(T, T, '/accept-invitation')).toEqual({ ok: true, redirectTo: '/accept-invitation' });
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: T, refresh_token: T });
  });
  it('open redirects are neutralised', async () => {
    auth.setSession.mockResolvedValue({ data: { user: { id: 'u1' }, session: {} }, error: null });
    expect(await completeFragmentSession(T, T, 'https://evil.com')).toEqual({ ok: true, redirectTo: '/' });
  });
  it('rejected / malformed tokens: no session assumed, no redirect', async () => {
    auth.setSession.mockResolvedValue({ data: { user: null, session: null }, error: { code: 'bad_jwt', status: 401 } });
    expect(await completeFragmentSession(T, T, '/accept-invitation')).toEqual({ ok: false });
    expect(await completeFragmentSession('x', T, '/')).toEqual({ ok: false });
  });
});

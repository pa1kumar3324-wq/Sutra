'use client';
import { useEffect, useRef, useState } from 'react';
import { completeFragmentSession } from '@/lib/actions/auth';
import { LINK_EXPIRED, safeNext } from '@/lib/auth/recovery';
import { AuthShell } from '@/components/layout/AuthShell';

const INVITE_EXPIRED = 'This invitation link is invalid or has expired. Ask your administrator to resend it.';

/**
 * Finishes email links whose tokens arrive in the URL #fragment (Supabase implicit flow, which is what
 * inviteUserByEmail uses by default). The server never sees a fragment, so /auth/callback hands the browser here.
 */
export default function Finish() {
  const started = useRef(false);   // React strict mode runs effects twice in dev; the tokens may be used only once
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const next = safeNext(new URLSearchParams(window.location.search).get('next'));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const access = hash.get('access_token');
    const refresh = hash.get('refresh_token');
    window.history.replaceState(null, '', window.location.pathname);   // keep tokens out of history/back button
    const recovery = next === '/reset-password';
    const fail = () => {
      setFailed(true);
      window.location.replace(`${recovery ? '/forgot-password' : '/login'}?error=${encodeURIComponent(recovery ? LINK_EXPIRED : INVITE_EXPIRED)}`);
    };
    if (hash.get('error') || hash.get('error_code') || !access || !refresh) return fail();
    completeFragmentSession(access, refresh, next)
      .then((r) => {
        if (!r.ok) {
          fail();
          return;
        }

        window.location.replace(r.redirectTo);
      })
      .catch(fail);
  }, []);
  return (
    <AuthShell title={failed ? 'Link problem' : 'Signing you in…'} sub={failed ? 'Taking you back…' : 'One moment while we verify your link.'}>
      <noscript><p className="text-sm text-muted">JavaScript is required to open this link.</p></noscript>
    </AuthShell>
  );
}

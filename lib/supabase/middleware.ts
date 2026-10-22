import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { NextResponse, type NextRequest } from 'next/server';
import { authDiag, errCode } from '@/lib/auth/diagnostics';

// /reset-password is public so the page can explain an invalid/expired link itself; it verifies the recovery session server-side.
const PUBLIC = ['/login', '/forgot-password', '/reset-password', '/auth/callback', '/auth/finish', '/api/health'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: CookieToSet[]) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Safety net: if Supabase falls back to the Site URL (redirect URL not on the allow-list) the link lands on e.g. "/"
  // with ?code= or ?token_hash= and would be bounced to /login with the credential lost. Forward it to the callback.
  const q = request.nextUrl.searchParams;
  if (!request.nextUrl.pathname.startsWith('/auth/') && (q.get('token_hash') || (q.get('code') && request.nextUrl.pathname === '/'))) {
    const fwd = request.nextUrl.clone();
    const t = q.get('type');
    fwd.pathname = '/auth/callback';
    if (!q.get('next')) fwd.searchParams.set('next', t === 'recovery' ? '/reset-password' : t === 'invite' ? '/accept-invitation' : '/');
    return NextResponse.redirect(fwd);
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();   // validates the JWT with Supabase Auth
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + '/'));
  if (!user && !isPublic) {
    authDiag('middleware_no_user', { code: errCode(userError), status: userError?.status ?? null, hasUser: false, hasSessionCookie: request.cookies.getAll().some((c) => c.name.startsWith('sb-')), path });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = path === '/' ? '' : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  // Do not redirect authenticated users away from /login here.
  // An authenticated user without an active organization membership is sent
  // from / to /login by requireContext(); redirecting them back to / creates
  // an infinite redirect loop. Let the login page render so they can see the
  // access error and recover.
  return response;
}

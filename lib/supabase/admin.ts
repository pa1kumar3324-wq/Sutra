import 'server-only';
import { createClient as create } from '@supabase/supabase-js';

/**
 * SERVICE-ROLE client: bypasses RLS. Server-only (the `server-only` import fails the build if this
 * is ever pulled into a client bundle). Use ONLY after an explicit requireAdmin() check, and only for
 * Auth Admin operations (staff invitations) and activating the caller's own invited membership.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return create(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

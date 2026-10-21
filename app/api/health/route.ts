import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** Liveness + database reachability. Returns no secrets and no student data. */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ status: 'misconfigured' }, { status: 503 });
  try {
    const res = await createClient(url, key).auth.getSession();    // reaches Supabase Auth without touching tables
    return NextResponse.json({ status: res.error ? 'degraded' : 'ok' }, { status: res.error ? 503 : 200 });
  } catch { return NextResponse.json({ status: 'down' }, { status: 503 }); }
}

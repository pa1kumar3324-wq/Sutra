import { NextResponse, type NextRequest } from 'next/server';
import { getContext } from '@/lib/auth/session';
import { toCsv } from '@/lib/domain/csv';
import { reportFilterSchema } from '@/lib/validations/schemas';
import { fetchAttendance, fetchResults } from '@/lib/reports';

export async function GET(req: NextRequest) {
  const ctx = await getContext();                                   // validates the session + active membership
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const kind = sp.kind;
  if (kind !== 'attendance' && kind !== 'assessments') return NextResponse.json({ error: 'Unknown export' }, { status: 400 });
  if (ctx.role === 'teacher') delete sp.teacher_id;
  const parsed = reportFilterSchema.safeParse(Object.fromEntries(Object.entries(sp).filter(([k, v]) => k !== 'kind' && v)));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const f = parsed.data;                                            // fetchers run as the user: RLS limits rows by role/class
  let csv: string;
  if (kind === 'attendance') {
    const rows = await fetchAttendance(ctx, f);
    csv = toCsv(['Date', 'Class', 'Subject', 'Teacher', 'Student code', 'Student', 'Attendance'], rows.map((r) => [r.date, r.class, r.subject, r.teacher, r.code, r.student, r.status]));
  } else {
    const rows = await fetchResults(ctx, f);
    csv = toCsv(['Date', 'Class', 'Subject', 'Topic', 'Teacher', 'Student code', 'Student', 'Outcome'], rows.map((r) => [r.date, r.class, r.subject, r.topic, r.teacher, r.code, r.student, r.outcome]));
  }
  await ctx.supabase.rpc('app_audit', { p_org: ctx.orgId, p_action: 'export', p_entity_type: kind, p_entity_id: null, p_meta: { from: f.from, to: f.to } });
  return new NextResponse(csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${kind}_${f.from}_to_${f.to}.csv"`,
  } });
}

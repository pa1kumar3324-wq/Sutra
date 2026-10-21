import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Flash, PageHeader, Pager, Select, Table, Td, btn, btn2, input, statusTone, Empty } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Students' };

const PAGE = 25;
export default async function Students({ searchParams: sp }: { searchParams: { q?: string; status?: string; class_id?: string; page?: string; ok?: string; error?: string } }) {
  const ctx = await requireAdmin();
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);
  const sel = sp.class_id ? 'id, full_name, student_code, current_school_grade, enrollment_status, enrollments!inner(status, class_id, classes(name))' : 'id, full_name, student_code, current_school_grade, enrollment_status, enrollments(status, classes(name))';
  let query = ctx.supabase.from('students').select(sel, { count: 'exact' }).eq('organization_id', ctx.orgId).order('full_name').range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.or(`full_name.ilike.%${q}%,student_code.ilike.%${q}%`);
  if (sp.status) query = query.eq('enrollment_status', sp.status);
  if (sp.class_id) query = query.eq('enrollments.class_id', sp.class_id).eq('enrollments.status', 'active');
  const [{ data, count }, { data: classes }] = await Promise.all([query, ctx.supabase.from('classes').select('id, name').eq('organization_id', ctx.orgId).order('name')]);
  const rows = (data ?? []) as any[];
  const base = `/admin/students?${new URLSearchParams({ ...(q && { q }), ...(sp.status && { status: sp.status }), ...(sp.class_id && { class_id: sp.class_id }) })}`;
  return (
    <>
      <PageHeader title="Students" actions={<Link className={btn} href="/admin/students/new">Register student</Link>} />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_160px_200px_auto]">
        <input name="q" defaultValue={q} placeholder="Search name or code" aria-label="Search" className={input} />
        <Select name="status" defaultValue={sp.status ?? ''}><option value="">Any status</option>{['active', 'inactive', 'graduated', 'withdrawn'].map((s) => <option key={s}>{s}</option>)}</Select>
        <Select name="class_id" defaultValue={sp.class_id ?? ''}><option value="">Any class</option>{(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <button className={btn2}>Filter</button>
      </form>
      {rows.length === 0 ? <Empty title="No students found" hint="Try different filters, or register a student." /> : (
        <>
          <div className="hidden md:block"><Table head={['Name', 'Code', 'Grade', 'Class', 'Status']}>
            {rows.map((s) => <tr key={s.id}><Td><Link className="font-medium text-gold-light underline decoration-gold/40 underline-offset-4 hover:decoration-gold" href={`/admin/students/${s.id}`}>{s.full_name}</Link></Td><Td>{s.student_code}</Td><Td>{s.current_school_grade}</Td>
              <Td>{(s.enrollments ?? []).filter((e: any) => e.status === 'active').map((e: any) => e.classes?.name).join(', ') || '–'}</Td><Td><Badge tone={statusTone(s.enrollment_status)}>{s.enrollment_status}</Badge></Td></tr>)}
          </Table></div>
          <ul className="space-y-2 md:hidden">{rows.map((s) => (
            <li key={s.id}><Link href={`/admin/students/${s.id}`} className="block panel p-3">
              <span className="font-semibold">{s.full_name}</span> <Badge tone={statusTone(s.enrollment_status)}>{s.enrollment_status}</Badge>
              <span className="block text-sm text-muted">{s.student_code} · Grade {s.current_school_grade} · {(s.enrollments ?? []).filter((e: any) => e.status === 'active').map((e: any) => e.classes?.name).join(', ') || 'No class'}</span></Link></li>))}</ul>
          <Pager base={base} page={page} pageSize={PAGE} total={count ?? 0} />
        </>)}
    </>
  );
}

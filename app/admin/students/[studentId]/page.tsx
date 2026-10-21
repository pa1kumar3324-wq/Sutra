import { Card, Flash, PageHeader, Select, btn, btn2, btnDanger } from '@/components/ui';
import { endEnrollment, enrollStudent, setStudentStatus, transferStudent } from '@/lib/actions/admin';
import { requireAdmin } from '@/lib/auth/session';
import { StudentProfile } from '@/components/students/StudentProfile';

export default async function StudentPage({ params, searchParams }: { params: { studentId: string }; searchParams: { ok?: string; error?: string } }) {
  const ctx = await requireAdmin();
  const [{ data: classes }, { data: active }] = await Promise.all([
    ctx.supabase.from('classes').select('id, name, academic_years(name)').eq('organization_id', ctx.orgId).eq('status', 'active').order('name'),
    ctx.supabase.from('enrollments').select('id, classes(name)').eq('student_id', params.studentId).eq('status', 'active'),
  ]);
  const opts = (classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.academic_years?.name})</option>);
  const cur = (active ?? []) as any[];
  return (
    <>
      <PageHeader title="Student" />
      <Flash ok={searchParams.ok} error={searchParams.error} />
      <StudentProfile ctx={ctx} studentId={params.studentId} />
      <Card title="Manage enrolment" className="mt-4">
        <div className="space-y-4">
          {cur.map((e) => (
            <div key={e.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
              <p className="w-full text-sm font-medium">Currently in {e.classes?.name}</p>
              <form action={transferStudent} className="flex flex-wrap items-end gap-2"><input type="hidden" name="enrollment_id" value={e.id} /><input type="hidden" name="student_id" value={params.studentId} />
                <Select name="class_id"><option value="">Transfer to…</option>{opts}</Select><button className={btn2}>Transfer</button></form>
              <form action={endEnrollment}><input type="hidden" name="enrollment_id" value={e.id} /><input type="hidden" name="student_id" value={params.studentId} /><button className={btn2}>End enrolment</button></form>
            </div>))}
          <form action={enrollStudent} className="flex flex-wrap items-end gap-2"><input type="hidden" name="student_id" value={params.studentId} />
            <Select name="class_id"><option value="">Enrol in a class…</option>{opts}</Select><button className={btn}>Enrol</button></form>
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {[['active', 'Mark active', btn2], ['inactive', 'Mark inactive', btn2], ['graduated', 'Graduated', btn2], ['withdrawn', 'Withdrawn', btnDanger]].map(([s, label, cls]) => (
              <form key={s as string} action={setStudentStatus}><input type="hidden" name="student_id" value={params.studentId} /><input type="hidden" name="status" value={s as string} /><button className={cls as string}>{label as string}</button></form>))}
          </div>
          <p className="text-xs text-muted">Changing status never deletes attendance or assessment history.</p>
        </div>
      </Card>
    </>
  );
}

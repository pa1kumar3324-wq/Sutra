import type { Metadata } from 'next';
import { Card, Field, Flash, PageHeader, Select, btn, input } from '@/components/ui';
import { createStudent } from '@/lib/actions/admin';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Register student' };

export default async function NewStudent({ searchParams }: { searchParams: { error?: string } }) {
  const ctx = await requireAdmin();
  const { data: classes } = await ctx.supabase.from('classes').select('id, name, academic_years(name)').eq('organization_id', ctx.orgId).eq('status', 'active').order('name');
  return (
    <>
      <PageHeader title="Register student" sub="Only collect what the trust needs to run classes." />
      <Flash error={searchParams.error} />
      <Card><form action={createStudent} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="full_name" required><input id="full_name" name="full_name" required maxLength={120} className={input} /></Field>
        <Field label="Student code" name="student_code" hint="Unique within your trust, e.g. S-2026-014." required><input id="student_code" name="student_code" required maxLength={40} className={input} /></Field>
        <Field label="School grade" name="current_school_grade" required><input id="current_school_grade" name="current_school_grade" required maxLength={40} className={input} /></Field>
        <Field label="Enrol in class" name="class_id"><Select name="class_id"><option value="">Not now</option>{(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.academic_years?.name})</option>)}</Select></Field>
        <Field label="Date of birth" name="date_of_birth"><input id="date_of_birth" name="date_of_birth" type="date" className={input} /></Field>
        <Field label="School" name="school_name"><input id="school_name" name="school_name" maxLength={120} className={input} /></Field>
        <div className="sm:col-span-2"><button className={btn}>Register student</button></div>
      </form></Card>
    </>
  );
}

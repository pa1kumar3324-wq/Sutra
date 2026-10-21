import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'My classes' };

export default async function Classes() {
  const ctx = await requireTeacher();
  const { data } = await ctx.supabase.from('teaching_assignments').select('id, class_id, classes(name, grade_level), subjects(name)').eq('teacher_user_id', ctx.userId).eq('status', 'active');
  const rows = (data ?? []) as any[];
  return (
    <>
      <PageHeader title="My classes" />
      {rows.length === 0 ? <Empty title="No classes assigned yet" hint="Ask a trust administrator to assign you a class and subject." /> :
        <ul className="grid gap-3 sm:grid-cols-2">{rows.map((a) => <li key={a.id}><Link href={`/teacher/classes/${a.class_id}`} className="block panel p-4 transition-colors hover:border-gold/50 hover:bg-raised"><p className="font-semibold">{a.classes?.name}</p><p className="text-sm text-muted">Grade {a.classes?.grade_level} · {a.subjects?.name}</p></Link></li>)}</ul>}
    </>
  );
}

import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { Card, Field, Flash, PageHeader, Select, btn, input } from '@/components/ui';
import { createSession } from '@/lib/actions/teacher';
import { requireTeacher, todayIn } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Start a session' };

export default async function NewSession({ params, searchParams }: { params: { classId: string }; searchParams: { error?: string; assignment?: string } }) {
  const ctx = await requireTeacher(); const sb = ctx.supabase;
  const { data: asg } = await sb.from('teaching_assignments').select('id, subject_id, subjects(name), classes(name)').eq('class_id', params.classId).eq('teacher_user_id', ctx.userId).eq('status', 'active');
  const list = (asg ?? []) as any[];
  if (list.length === 0) notFound();
  const chosen = list.find((a) => a.id === searchParams.assignment) ?? list[0];
  const [{ data: topics }, { count }] = await Promise.all([
    sb.from('topics').select('id, name').eq('subject_id', chosen.subject_id).eq('status', 'active').order('sequence_order', { nullsFirst: false }).order('name'),
    sb.from('enrollments').select('id', { count: 'exact', head: true }).eq('class_id', params.classId).eq('status', 'active'),
  ]);
  return (
    <>
      <PageHeader title="Start a session" sub={`${chosen.classes?.name} · ${chosen.subjects?.name} · ${count ?? 0} students`} />
      <Flash error={searchParams.error} />
      {list.length > 1 && <form className="mb-4 flex gap-2"><Select name="assignment" defaultValue={chosen.id}>{list.map((a) => <option key={a.id} value={a.id}>{a.subjects?.name}</option>)}</Select><button className="min-h-[44px] rounded-lg border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised">Switch subject</button></form>}
      <Card><form action={createSession} className="space-y-4">
        <input type="hidden" name="class_id" value={params.classId} /><input type="hidden" name="assignment_id" value={chosen.id} />
        <input type="hidden" name="request_key" value={randomUUID()} />
        <Field label="Date" name="session_date" required><input id="session_date" name="session_date" type="date" required defaultValue={todayIn(ctx.timezone)} className={input} /></Field>
        <fieldset><legend className="mb-1 text-sm font-medium">Topics covered today</legend>
          {(topics ?? []).length === 0 ? <p className="text-sm text-muted">No topics exist for {chosen.subjects?.name} yet. Ask an administrator to add some, or add them after you start.</p> :
            <div className="grid gap-2 sm:grid-cols-2">{(topics as any[]).map((t) => <label key={t.id} className="flex min-h-[44px] items-center gap-3 rounded-lg border border-line-strong bg-inset px-3 transition-colors hover:border-gold/50 has-[:checked]:border-gold/70 has-[:checked]:bg-brand-soft"><input type="checkbox" name="topic_ids" value={t.id} className="h-5 w-5 shrink-0" />{t.name}</label>)}</div>}</fieldset>
        <Field label="Lesson notes" name="notes"><textarea id="notes" name="notes" rows={3} maxLength={2000} className={input} /></Field>
        <button className={btn}>Start session</button>
      </form></Card>
    </>
  );
}

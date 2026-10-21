import type { Metadata } from 'next';
import { Card, Field, Flash, PageHeader, btn, input } from '@/components/ui';
import { updateSettings } from '@/lib/actions/admin';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Settings' };

export default async function Settings({ searchParams: sp }: { searchParams: { ok?: string; error?: string } }) {
  const ctx = await requireAdmin();
  const { data: o } = await ctx.supabase.from('organizations').select('name, contact_email, timezone').eq('id', ctx.orgId).single();
  return (
    <>
      <PageHeader title="Organization settings" /><Flash ok={sp.ok} error={sp.error} />
      <Card><form action={updateSettings} className="grid gap-4 sm:max-w-lg">
        <Field label="Trust name" name="name" required><input id="name" name="name" required defaultValue={o?.name} className={input} /></Field>
        <Field label="Contact email" name="contact_email"><input id="contact_email" name="contact_email" type="email" defaultValue={o?.contact_email ?? ''} className={input} /></Field>
        <Field label="Timezone" name="timezone" hint="IANA name, e.g. Asia/Kolkata. Times are stored in UTC and shown in this zone." required><input id="timezone" name="timezone" required defaultValue={o?.timezone} className={input} /></Field>
        <div><button className={btn}>Save settings</button></div></form></Card>
    </>
  );
}

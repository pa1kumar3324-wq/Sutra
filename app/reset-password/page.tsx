import type { Metadata } from 'next';
import { resetPassword } from '@/lib/actions/auth';
import { AuthShell } from '@/components/layout/AuthShell';
import { Field, Flash, btn, input } from '@/components/ui';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function Page({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  return (
    <AuthShell title="Choose a new password">
      <Flash error={searchParams.error} ok={searchParams.ok} />
      <form action={resetPassword} className="space-y-4">
        <Field label="New password" name="password" hint="At least 10 characters." required><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={input} /></Field>
        <Field label="Confirm password" name="confirm" required><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={input} /></Field>
        <button className={btn + ' w-full'}>Save new password</button>
      </form>
    </AuthShell>
  );
}

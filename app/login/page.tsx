import type { Metadata } from 'next';
import Link from 'next/link';
import { login } from '@/lib/actions/auth';
import { AuthShell } from '@/components/layout/AuthShell';
import { Field, Flash, btn, input, link } from '@/components/ui';

export const metadata: Metadata = { title: 'Sign in' };

export default function Login({ searchParams }: { searchParams: { error?: string; ok?: string; next?: string } }) {
  return (
    <AuthShell title="Sign in" sub="Learning progress and attendance for trust staff." footer={<Link href="/forgot-password" className={link}>Forgot your password?</Link>}>
      <Flash error={searchParams.error} ok={searchParams.ok} />
      <form action={login} className="space-y-4">
        <input type="hidden" name="next" value={searchParams.next ?? ''} />
        <Field label="Email" name="email" required><input id="email" name="email" type="email" autoComplete="username" required className={input} /></Field>
        <Field label="Password" name="password" required><input id="password" name="password" type="password" autoComplete="current-password" required className={input} /></Field>
        <button className={btn + ' w-full'}>Sign in</button>
      </form>
    </AuthShell>
  );
}

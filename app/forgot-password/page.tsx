import type { Metadata } from 'next';
import Link from 'next/link';
import { forgotPassword } from '@/lib/actions/auth';
import { AuthShell } from '@/components/layout/AuthShell';
import { Field, Flash, btn, input, link } from '@/components/ui';

export const metadata: Metadata = { title: 'Reset your password' };

export default function Forgot({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  return (
    <AuthShell title="Reset your password" sub="Enter your email and we will send you a reset link." footer={<Link href="/login" className={link}>Back to sign in</Link>}>
      <Flash error={searchParams.error} ok={searchParams.ok} />
      <form action={forgotPassword} className="space-y-4">
        <Field label="Email" name="email" required><input id="email" name="email" type="email" autoComplete="email" required className={input} /></Field>
        <button className={btn + ' w-full'}>Email me a reset link</button>
      </form>
    </AuthShell>
  );
}

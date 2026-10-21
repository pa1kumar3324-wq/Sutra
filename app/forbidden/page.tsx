import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { btn } from '@/components/ui';

export const metadata: Metadata = { title: 'No access' };

export default function Forbidden() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <Lock size={26} className="mx-auto mb-4 text-gold" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">You don’t have access to that page</h1>
      <p className="mt-2 text-muted">Your role doesn’t include this area. Ask a trust administrator if you need access.</p>
      <Link href="/" className={`${btn} mt-6`}>Go to your home page</Link>
    </main>
  );
}

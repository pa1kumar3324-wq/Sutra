import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { btn } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <SearchX size={26} className="mx-auto mb-4 text-gold" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">We can’t find that record</h1>
      <p className="mt-2 text-muted">It may have been archived, or you may not have access to it.</p>
      <Link href="/" className={`${btn} mt-6`}>Back to home</Link>
    </main>
  );
}

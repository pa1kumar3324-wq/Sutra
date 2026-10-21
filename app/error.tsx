'use client';
import { ErrorState } from '@/components/states';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <main><ErrorState reset={reset} /></main>; }

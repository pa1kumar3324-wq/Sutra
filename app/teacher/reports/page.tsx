import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { ReportsView } from '@/components/reports/ReportsView';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'My reports' };

export default async function Reports({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireTeacher();
  return <><PageHeader title="My reports" sub="Covers the sessions you teach." /><ReportsView ctx={ctx} sp={searchParams} base="/teacher/reports" /></>;
}

import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { ReportsView } from '@/components/reports/ReportsView';
import { requireContext } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Reports' };

export default async function Reports({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireContext();      // owner/admin/coordinator/auditor; RLS decides what rows come back
  return <><PageHeader title="Reports" sub="Attendance and learning outcomes, from recorded data only." /><ReportsView ctx={ctx} sp={searchParams} base="/admin/reports" /></>;
}

import { Shell } from '@/components/layout/Shell';
import { requireAdmin } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  return <Shell ctx={ctx}>{children}</Shell>;
}

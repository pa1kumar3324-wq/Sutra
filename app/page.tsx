import { redirect } from 'next/navigation';
import { requireContext, isAdminRole } from '@/lib/auth/session';

export default async function Home() {
  const ctx = await requireContext();
  redirect(isAdminRole(ctx.role) ? '/admin/dashboard' : ctx.role === 'teacher' ? '/teacher/dashboard' : '/admin/reports');
}

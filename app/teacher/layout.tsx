import { Shell } from '@/components/layout/Shell';
import { requireTeacher } from '@/lib/auth/session';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTeacher();
  return <Shell ctx={ctx}>{children}</Shell>;
}

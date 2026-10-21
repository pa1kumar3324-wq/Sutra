import { PageHeader } from '@/components/ui';
import { StudentProfile } from '@/components/students/StudentProfile';
import { requireTeacher } from '@/lib/auth/session';

export default async function TeacherStudent({ params }: { params: { studentId: string } }) {
  const ctx = await requireTeacher();
  return <><PageHeader title="Student" sub="You see outcomes recorded in your own sessions." /><StudentProfile ctx={ctx} studentId={params.studentId} /></>;
}

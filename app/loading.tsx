import { Mark } from '@/components/brand/Logo';
export default function Loading() {
  return <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted"><Mark className="w-10 animate-pulse" /><span className="text-sm">Loading</span></div>;
}

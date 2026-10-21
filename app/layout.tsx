import '@fontsource-variable/manrope';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: 'Sutra', template: '%s · Sutra' },
  description: 'Sutra by Emporum: learning progress and attendance for tuition trusts',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#10100f' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

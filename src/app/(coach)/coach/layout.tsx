import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import CoachSidebar from './CoachSidebar';

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg-page)' }}>
      <CoachSidebar session={session} />
      <main
        style={{
          flex: 1,
          marginLeft: '240px',
          padding: '2rem 2.5rem',
          background: 'transparent',
          color: 'var(--color-text-primary)',
        }}
      >
        {children}
      </main>
    </div>
  );
}

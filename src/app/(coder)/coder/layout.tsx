import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import CoderSidebar from './CoderSidebar';

export default async function CoderLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg-page)' }}>
      <CoderSidebar session={session} />
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

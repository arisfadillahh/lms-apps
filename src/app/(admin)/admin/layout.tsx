import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import AdminSidebar from './AdminSidebar';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg-page)' }}>
      <AdminSidebar session={session} />
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


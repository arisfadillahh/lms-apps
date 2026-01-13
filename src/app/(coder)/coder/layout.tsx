import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import CoderSidebar from './CoderSidebar';
import DashboardHeader from '@/components/layout/DashboardHeader';
import PageTransition from '@/components/PageTransition';

export default async function CoderLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  const user = await usersDao.getUserById(session.user.id);

  if (!user) return null; // Should not happen if session exists

  const userForHeader = {
    id: user.id,
    fullName: user.full_name,
    role: user.role,
    avatarPath: user.avatar_path
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F5F7FA' }}>
      <CoderSidebar session={session} />
      <main
        style={{
          flex: 1,
          marginLeft: '240px',
          padding: '2rem 2.5rem',
          background: 'transparent',
          color: 'var(--color-text-primary)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <DashboardHeader user={userForHeader} />
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}

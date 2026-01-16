import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import CoderSidebar from './CoderSidebar';
import DashboardHeader from '@/components/layout/DashboardHeader';
import PageTransition from '@/components/PageTransition';

import { redirect } from 'next/navigation';

export default async function CoderLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await usersDao.getUserById(session.user.id);

  if (!user) return null; // Should not happen if session exists

  const userForHeader = {
    id: user.id,
    fullName: user.full_name,
    role: user.role,
    // avatarPath: user.avatar_path // Commented out as type says it doesn't exist
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F5F7FA' }}>
      <CoderSidebar session={session} />
      <main
        className="coder-main-content"
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

      {/* Responsive CSS for mobile */}
      <style>{`
        @media (max-width: 768px) {
          .coder-main-content {
            margin-left: 0 !important;
            padding: 1rem !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
            overflow-y: visible !important;
            min-height: auto !important;
            height: auto !important;
          }
          .coder-sidebar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import CoachSidebar from './CoachSidebar';
import DashboardHeader from '@/components/layout/DashboardHeader';
import PageTransition from '@/components/PageTransition';

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) return null;

  const user = await usersDao.getUserById(session.user.id);
  if (!user) return null;

  const userWithAvatar = user as typeof user & { avatar_path?: string | null };

  const userForHeader = {
    id: user.id,
    fullName: user.full_name,
    role: user.role,
    avatarPath: userWithAvatar.avatar_path ?? null
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F5F7FA' }}>
      <CoachSidebar session={session} />
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

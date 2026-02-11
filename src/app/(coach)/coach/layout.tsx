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

  const userForHeader = {
    id: user.id,
    fullName: user.full_name,
    role: user.role,
    avatarPath: user.avatar_path ?? null
  };

  return (
    <div className="min-h-screen flex bg-slate-50/50">
      <div className="hidden md:block fixed inset-y-0 z-30">
        <CoachSidebar session={session} />
      </div>

      <main className="flex-1 flex flex-col min-h-screen transition-all duration-300 md:ml-64">
        <DashboardHeader user={userForHeader} />
        <div className="flex-1 p-4 md:p-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}

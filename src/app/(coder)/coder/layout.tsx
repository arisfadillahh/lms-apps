import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import CoderSidebar from './CoderSidebar';
import CoderHeader from './dashboard/CoderHeader';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { redirect } from 'next/navigation';

export default async function CoderLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await usersDao.getUserById(session.user.id);

  if (!user) return null;

  const userName = session.user.fullName?.split(' ')[0] || 'Coder';
  const todayDate = format(new Date(), 'EEEE, d MMMM yyyy', { locale: id });

  return (
    <div className="bg-background-light text-slate-800 font-display min-h-screen antialiased flex">
      <CoderSidebar session={session} />
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <CoderHeader
          userName={userName}
          fullName={session.user.fullName || 'Coder'}
          todayDate={todayDate}
          avatarPath={(session.user as any).avatarPath}
          role={session.user.role}
          username={(session.user as any).username}
          adminPermissions={(session.user as any).adminPermissions}
        />
        {children}
      </main>

      {/* Responsive CSS for mobile */}
      <style>{`
        @media (max-width: 768px) {
          .coder-sidebar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

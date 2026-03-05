import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import CoderSidebar from './CoderSidebar';

import { redirect } from 'next/navigation';

export default async function CoderLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await usersDao.getUserById(session.user.id);

  if (!user) return null;

  return (
    <div className="bg-background-light text-slate-800 font-display min-h-screen antialiased flex">
      <CoderSidebar session={session} />
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
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

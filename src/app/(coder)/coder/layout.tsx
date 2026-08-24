import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import CoderSidebar from './CoderSidebar';
import CoderHeader from './dashboard/CoderHeader';
import CoderThemeProvider from '@/components/coder/CoderThemeProvider';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { redirect } from 'next/navigation';
import PushSubscriptionAccountSync from '@/components/pwa/PushSubscriptionAccountSync';

export default async function CoderLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  let user;
  try {
    user = await usersDao.getUserById(session.user.id);
  } catch (error) {
    console.warn('[CoderLayout] Invalid session user; redirecting to login', error);
    redirect('/login');
  }

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'CODER' || !user.is_active) {
    redirect('/login');
  }

  const userName = session.user.fullName?.split(' ')[0] || 'Coder';
  const todayDate = format(new Date(), 'EEEE, d MMMM yyyy', { locale: id });

  return (
    <CoderThemeProvider>
      <PushSubscriptionAccountSync />
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var p=localStorage.getItem('clevio-coder-theme')||'auto';var d=p==='dark'||(p==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';document.documentElement.dataset.coderTheme=d;}catch(e){}})()`,
        }}
      />
      <div className="coder-app-shell bg-background-light text-slate-800 font-display min-h-screen antialiased flex">
        <CoderSidebar session={session} />
        <main className="coder-main flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <CoderHeader
            userName={userName}
            fullName={session.user.fullName || 'Coder'}
            todayDate={todayDate}
            avatarPath={session.user.avatarPath}
            role={session.user.role}
            username={session.user.username}
            adminPermissions={session.user.adminPermissions}
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
    </CoderThemeProvider>
  );
}

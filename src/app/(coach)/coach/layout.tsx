import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import CoachSidebar from './CoachSidebar';
import PageTransition from '@/components/PageTransition';
import CoachDashboardHeader from '@/components/coach/CoachDashboardHeader';
import CoachMobileNav from './CoachMobileNav';
import { redirect } from 'next/navigation';
import IssueReportButton from '@/components/issue-reports/IssueReportButton';

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  let user;
  try {
    user = await usersDao.getUserById(session.user.id);
  } catch (error) {
    console.warn('[CoachLayout] Invalid session user; redirecting to login', error);
    redirect('/login');
  }

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'COACH' || !user.is_active) {
    redirect('/login');
  }

  return (
      <div className="coach-app-shell min-h-screen flex antialiased bg-[#f1f5f9] text-[#0f172a] font-sans">
        {/* Google Fonts: Material Symbols + Plus Jakarta Sans */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />

      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-weight: normal; font-style: normal;
          font-size: 24px; line-height: 1;
          letter-spacing: normal; text-transform: none;
          display: inline-block; white-space: nowrap; direction: ltr;
          -webkit-font-smoothing: antialiased;
        }
        .active-icon {
          font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .sidebar-active-indicator {
          width: 4px; height: 20px;
          background-color: #6bb3ff;
          position: absolute; left: 0;
          border-radius: 0 4px 4px 0;
        }
      `}</style>

      {/* Dark Sidebar — desktop only */}
      <div className="hidden md:block">
        <CoachSidebar />
      </div>

      {/* Main content */}
      <main className="coach-main min-w-0 flex-1 flex flex-col min-h-screen md:ml-[260px]">
        <CoachDashboardHeader user={{
            id: user.id,
            fullName: user.full_name,
            role: user.role,
            avatarPath: user.avatar_path
        }} />
        <div className="flex-1 px-4 pb-24 md:px-8 md:pb-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
      <CoachMobileNav />
      <IssueReportButton role="COACH" />
    </div>
  );
}

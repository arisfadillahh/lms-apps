import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import CoachSidebar from './CoachSidebar';
import CoachMobileNav from './CoachMobileNav';
import PageTransition from '@/components/PageTransition';
import CoachDashboardHeader from '@/components/coach/CoachDashboardHeader';

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) return null;

  const user = await usersDao.getUserById(session.user.id);
  if (!user) return null;

  return (
    <div className="min-h-screen flex antialiased bg-[#f1f5f9] text-[#0f172a] font-sans">
      {/* Google Fonts: Material Symbols + Plus Jakarta Sans */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
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
      <main className="flex-1 flex flex-col min-h-screen md:ml-[260px] flex-grow px-8 pb-8">
        <CoachDashboardHeader user={{
            id: user.id,
            fullName: user.full_name,
            role: user.role,
            avatarPath: user.avatar_path
        }} />
        <div className="flex-1 pb-24 md:pb-0">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <CoachMobileNav />
    </div>
  );
}

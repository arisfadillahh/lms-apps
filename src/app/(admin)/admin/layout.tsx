import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import AdminSidebar from './AdminSidebar';
import PageTransition from '@/components/PageTransition';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { redirect } from 'next/navigation';
import { usersDao } from '@/lib/dao';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await usersDao.getUserById(session.user.id);

  if (!user) return null;

  const userForHeader = {
    id: user.id,
    fullName: user.full_name,
    role: user.role,
    avatarPath: user.avatar_path ?? null,
    adminPermissions: user.admin_permissions,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc' }}>
      <AdminSidebar session={session} />
      <main
        className="admin-main-content"
        style={{
          flex: 1,
          marginLeft: '240px',
          padding: '2rem 2.5rem',
          background: 'transparent',
          color: '#1e293b',
        }}
      >
        <DashboardHeader user={userForHeader} />
        <PageTransition>{children}</PageTransition>
      </main>

      {/* Responsive CSS for mobile */}
      <style>{`
        @media (max-width: 768px) {
          .admin-main-content {
            margin-left: 0 !important;
            padding: 1rem !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
            overflow-y: visible !important;
            min-height: auto !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

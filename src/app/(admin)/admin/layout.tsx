import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import AdminSidebar from './AdminSidebar';
import PageTransition from '@/components/PageTransition';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

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
        <DashboardHeader user={session.user} />
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


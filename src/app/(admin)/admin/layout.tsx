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
    </div>
  );
}


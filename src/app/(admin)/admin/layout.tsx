import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import PageTransition from '@/components/PageTransition';
import AdminClientWrapper from '@/components/admin/AdminClientWrapper';
import AdminChrome from '@/components/admin/AdminChrome';
import { redirect } from 'next/navigation';
import { usersDao } from '@/lib/dao';
import IssueReportButton from '@/components/issue-reports/IssueReportButton';
import PushSubscriptionAccountSync from '@/components/pwa/PushSubscriptionAccountSync';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  let user;
  try {
    user = await usersDao.getUserById(session.user.id);
  } catch (error) {
    console.warn('[AdminLayout] Invalid session user; redirecting to login', error);
    redirect('/login');
  }

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'ADMIN' || !user.is_active) {
    redirect('/login');
  }

  const userForHeader = {
    id: user.id,
    fullName: user.full_name,
    role: user.role,
    username: user.username,
    avatarPath: user.avatar_path ?? null,
    adminPermissions: user.admin_permissions,
  };

  return (
    <AdminChrome user={userForHeader}>
      <PushSubscriptionAccountSync userId={user.id} />
      <AdminClientWrapper>
        <PageTransition>{children}</PageTransition>
      </AdminClientWrapper>
      <IssueReportButton role="ADMIN" />
    </AdminChrome>
  );
}

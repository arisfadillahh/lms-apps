import type { ReactNode } from 'react';
import { getServerAuthSession } from '@/lib/auth';
import PageTransition from '@/components/PageTransition';
import AdminClientWrapper from '@/components/admin/AdminClientWrapper';
import AdminChrome from '@/components/admin/AdminChrome';
import { redirect } from 'next/navigation';
import { usersDao } from '@/lib/dao';

export const dynamic = 'force-dynamic';

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
    username: user.username,
    avatarPath: user.avatar_path ?? null,
    adminPermissions: user.admin_permissions,
  };

  return (
    <AdminChrome user={userForHeader}>
      <AdminClientWrapper>
        <PageTransition>{children}</PageTransition>
      </AdminClientWrapper>
    </AdminChrome>
  );
}

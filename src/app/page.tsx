import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { getRoleDashboardPath } from '@/lib/routing';

export default async function RootPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  redirect(getRoleDashboardPath(session.user.role));
}

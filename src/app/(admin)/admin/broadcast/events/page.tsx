import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { listEventBroadcastAdminData } from '@/lib/services/eventBroadcastService';

import EventBroadcastClient from './EventBroadcastClient';

export const dynamic = 'force-dynamic';

export default async function EventBroadcastPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  const initialData = await listEventBroadcastAdminData();
  return <EventBroadcastClient initialData={initialData} />;
}

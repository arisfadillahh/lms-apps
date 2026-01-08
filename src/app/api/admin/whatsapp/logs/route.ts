import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { reportsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

export async function GET() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  try {
    const logs = await reportsDao.listWhatsappLogs();
    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Failed to list WhatsApp logs', error);
    return NextResponse.json({ error: error.message ?? 'Failed to fetch logs' }, { status: 500 });
  }
}

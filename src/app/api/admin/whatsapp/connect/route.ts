import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { requestConnection } from '@/lib/whatsapp/client';

export async function POST() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  try {
    await requestConnection();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to request WhatsApp connection', error);
    return NextResponse.json({ error: error.message ?? 'Unable to request connection' }, { status: 502 });
  }
}

import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getStatus } from '@/lib/whatsapp/client';

export async function GET() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  try {
    const status = await getStatus();
    return NextResponse.json({ status });
  } catch (error: any) {
    console.error('Failed to fetch WhatsApp status', error);
    return NextResponse.json({ error: error.message ?? 'Unable to reach WhatsApp worker' }, { status: 502 });
  }
}

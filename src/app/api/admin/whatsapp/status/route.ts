import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getWhatsAppStatus } from '@/lib/services/whatsappClient';

export async function GET() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  try {
    const status = await getWhatsAppStatus();
    return NextResponse.json({ status });
  } catch (error: any) {
    console.error('Failed to fetch WhatsApp status', error);
    return NextResponse.json({ error: error.message ?? 'Unable to reach WhatsApp worker' }, { status: 502 });
  }
}

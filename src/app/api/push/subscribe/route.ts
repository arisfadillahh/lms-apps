import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { removePushSubscription, savePushSubscription } from '@/lib/pushNotifications';

export async function POST(request: Request) {
  try {
    const session = await getSessionOrThrow();
    const body = await request.json();
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return NextResponse.json({ error: 'Subscription push tidak valid' }, { status: 400 });
    }
    await savePushSubscription(session.user.id, body, request.headers.get('user-agent'));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized' || message === 'Inactive account') return NextResponse.json({ error: 'Sesi login tidak valid' }, { status: 401 });
    console.error('[Push] Subscribe failed', error);
    return NextResponse.json({ error: 'Gagal mengaktifkan notifikasi' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionOrThrow();
    const body = await request.json();
    if (!body?.endpoint) return NextResponse.json({ error: 'Endpoint push tidak valid' }, { status: 400 });
    await removePushSubscription(session.user.id, body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized' || message === 'Inactive account') return NextResponse.json({ error: 'Sesi login tidak valid' }, { status: 401 });
    return NextResponse.json({ error: 'Gagal menonaktifkan notifikasi' }, { status: 500 });
  }
}

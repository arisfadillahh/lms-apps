import { NextResponse } from 'next/server';

import { verifyCronRequest } from '@/lib/cron';
import { processDueEventBroadcasts } from '@/lib/services/eventBroadcastService';

export const dynamic = 'force-dynamic';

async function run(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await processDueEventBroadcasts());
  } catch (error) {
    console.error('[EventBroadcast] Reminder job failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Event reminder job failed' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;

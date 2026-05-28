import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { generateDraftReportsForEkskulSession } from '@/lib/services/aiReports';

const generateEkskulReportSchema = z.object({
  sessionId: z.string().uuid(),
});

export const runtime = 'nodejs';

function scheduleEkskulReportGeneration(sessionId: string, coachId: string) {
  setTimeout(() => {
    void generateDraftReportsForEkskulSession(sessionId, coachId)
      .then((result) => {
        console.log('[Generate Ekskul Report] Completed', { sessionId, coachId, ...result });
      })
      .catch((error) => {
        console.error('[Generate Ekskul Report] Failed', {
          sessionId,
          coachId,
          error: error instanceof Error ? error.message : error,
        });
      });
  }, 0);
}

export async function POST(request: Request) {
  let coachId: string;
  try {
    const session = await getSessionOrThrow();
    const coachSession = await assertRole(session, 'COACH');
    coachId = coachSession.user.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Unauthorized' || message === 'Unauthenticated' ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = generateEkskulReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await generateDraftReportsForEkskulSession(parsed.data.sessionId, coachId, { validateOnly: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal generate rapor ekskul';
    const status = message === 'Forbidden' ? 403 : 409;
    return NextResponse.json({ error: message }, { status });
  }

  scheduleEkskulReportGeneration(parsed.data.sessionId, coachId);

  return NextResponse.json({ success: true, queued: true }, { status: 202 });
}

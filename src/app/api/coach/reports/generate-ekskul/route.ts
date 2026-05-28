import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { generateDraftReportsForEkskulSession } from '@/lib/services/aiReports';

const generateEkskulReportSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await getSessionOrThrow();
  const coachSession = await assertRole(session, 'COACH');

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
    const result = await generateDraftReportsForEkskulSession(parsed.data.sessionId, coachSession.user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal generate rapor ekskul';
    const status = message === 'Forbidden' ? 403 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}

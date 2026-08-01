import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { getTrialClassSubmission, setTrialClassTerminalStatus } from '@/lib/dao/trialClassDao';
import { assertRole } from '@/lib/roles';
import { deleteTrialCalendarEvent } from '@/lib/services/googleTrialCalendar';

export const runtime = 'nodejs';

const terminalStatusSchema = z.object({
  status: z.enum(['CANCELLED', 'FAILED']),
  reason: z.string().trim().min(5, 'Alasan minimal 5 karakter.').max(1000),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id } = await context.params;
    const parsed = terminalStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Status atau alasan tidak valid.' }, { status: 400 });
    }

    const trial = await getTrialClassSubmission(id);
    if (!trial) {
      return NextResponse.json({ error: 'Data trial tidak ditemukan.' }, { status: 404 });
    }
    if (trial.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'Hanya trial yang sudah terjadwal yang dapat dibatalkan atau ditandai gagal.' }, { status: 409 });
    }

    if (trial.google_calendar_event_id) {
      await deleteTrialCalendarEvent(trial.google_calendar_event_id).catch((calendarError) => {
        console.error('[FreeTrial] Failed to delete Google Calendar event', calendarError);
      });
    }

    const updated = await setTrialClassTerminalStatus(id, parsed.data.status, parsed.data.reason);
    return NextResponse.json({ ok: true, trial: updated });
  } catch (error) {
    console.error('[FreeTrial] Failed to update trial status', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal memperbarui status trial.' },
      { status: 500 },
    );
  }
}

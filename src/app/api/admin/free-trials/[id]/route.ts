import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { getAssessmentByTrialId } from '@/lib/dao/trialAssessmentsDao';
import { deleteTrialClassSubmission, getTrialClassSubmission } from '@/lib/dao/trialClassDao';
import { assertRole } from '@/lib/roles';
import { deleteTrialCalendarEvent } from '@/lib/services/googleTrialCalendar';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id } = await context.params;
    const trial = await getTrialClassSubmission(id);
    if (!trial) {
      return NextResponse.json({ error: 'Data trial tidak ditemukan.' }, { status: 404 });
    }

    const assessment = await getAssessmentByTrialId(id);
    if (assessment && assessment.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Trial yang sudah memiliki assessment aktif tidak dapat dihapus. Batalkan atau selesaikan prosesnya terlebih dahulu.' },
        { status: 409 },
      );
    }

    if (trial.google_calendar_event_id) {
      await deleteTrialCalendarEvent(trial.google_calendar_event_id).catch((calendarError) => {
        console.error('[FreeTrial] Failed to delete Google Calendar event', calendarError);
      });
    }

    const deleted = await deleteTrialClassSubmission(id);
    return NextResponse.json({ ok: true, trial: deleted });
  } catch (error) {
    console.error('[FreeTrial] Failed to delete trial', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menghapus trial.' },
      { status: 500 },
    );
  }
}

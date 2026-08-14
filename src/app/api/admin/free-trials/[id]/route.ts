import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { getAssessmentByTrialId } from '@/lib/dao/trialAssessmentsDao';
import { deleteTrialClassSubmission, getTrialClassSubmission } from '@/lib/dao/trialClassDao';
import { assertRole } from '@/lib/roles';
import { deleteTrialCalendarEvent } from '@/lib/services/googleTrialCalendar';
import { deleteTrialForAdmin, TrialDeletionError } from '@/lib/services/adminTrialDeletion';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id } = await context.params;
    const deleted = await deleteTrialForAdmin(id, {
      getTrial: getTrialClassSubmission,
      getAssessment: getAssessmentByTrialId,
      deleteCalendarEvent: deleteTrialCalendarEvent,
      deleteTrial: deleteTrialClassSubmission,
    });
    return NextResponse.json({ ok: true, trial: deleted });
  } catch (error) {
    console.error('[FreeTrial] Failed to delete trial', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menghapus trial.' },
      { status: error instanceof TrialDeletionError ? error.status : 500 },
    );
  }
}

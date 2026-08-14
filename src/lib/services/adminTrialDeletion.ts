import type { TrialClassSubmission } from '@/lib/dao/trialClassDao';

export class TrialDeletionError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 409 | 502,
  ) {
    super(message);
    this.name = 'TrialDeletionError';
  }
}

type DeletionTrial = Pick<TrialClassSubmission, 'id' | 'google_calendar_event_id'>;
type DeletionAssessment = { status: string };

export type AdminTrialDeletionDependencies = {
  getTrial: (id: string) => Promise<DeletionTrial | null>;
  getAssessment: (id: string) => Promise<DeletionAssessment | null>;
  deleteCalendarEvent: (eventId: string) => Promise<void>;
  deleteTrial: (id: string) => Promise<TrialClassSubmission>;
};

export async function deleteTrialForAdmin(
  id: string,
  dependencies: AdminTrialDeletionDependencies,
): Promise<TrialClassSubmission> {
  const trial = await dependencies.getTrial(id);
  if (!trial) {
    throw new TrialDeletionError('Data trial tidak ditemukan.', 404);
  }

  const assessment = await dependencies.getAssessment(id);
  if (assessment) {
    throw new TrialDeletionError(
      'Trial yang sudah memiliki assessment tidak dapat dihapus. Selesaikan proses assessment terlebih dahulu.',
      409,
    );
  }

  if (trial.google_calendar_event_id) {
    try {
      await dependencies.deleteCalendarEvent(trial.google_calendar_event_id);
    } catch {
      throw new TrialDeletionError(
        'Jadwal Google Calendar gagal dihapus sehingga data trial tidak diubah.',
        502,
      );
    }
  }

  return dependencies.deleteTrial(id);
}

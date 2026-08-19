export type TrialOutcomeStatus =
  | 'NOT_YET_TRIAL'
  | 'COMPLETED_NOT_REGISTERED'
  | 'COMPLETED_REGISTERED'
  | 'NOT_PROCEEDING';

export const TRIAL_OUTCOME_LABELS: Record<TrialOutcomeStatus, string> = {
  NOT_YET_TRIAL: 'Belum trial',
  COMPLETED_NOT_REGISTERED: 'Trial selesai, belum daftar',
  COMPLETED_REGISTERED: 'Trial selesai, sudah daftar',
  NOT_PROCEEDING: 'Tidak jadi sebelum trial',
};

export const TRIAL_OUTCOME_STYLES: Record<TrialOutcomeStatus, string> = {
  NOT_YET_TRIAL: 'border-amber-200 bg-amber-50 text-amber-800',
  COMPLETED_NOT_REGISTERED: 'border-sky-200 bg-sky-50 text-sky-800',
  COMPLETED_REGISTERED: 'border-green-200 bg-green-50 text-green-800',
  NOT_PROCEEDING: 'border-slate-200 bg-slate-100 text-slate-700',
};

export type TrialOutcomeInput = {
  scheduleStatus: 'PENDING' | 'SCHEDULED' | 'CANCELLED' | 'FAILED';
  assessmentStatus?: string | null;
  invoiceStatus?: string | null;
};

export function deriveTrialOutcome({
  scheduleStatus,
  assessmentStatus,
  invoiceStatus,
}: TrialOutcomeInput): TrialOutcomeStatus {
  if (scheduleStatus === 'CANCELLED' || scheduleStatus === 'FAILED') {
    return 'NOT_PROCEEDING';
  }

  // A trial is only counted as registered after its linked invoice is paid.
  if (invoiceStatus === 'PAID') {
    return 'COMPLETED_REGISTERED';
  }

  if (assessmentStatus && assessmentStatus !== 'DRAFT') {
    return 'COMPLETED_NOT_REGISTERED';
  }

  return 'NOT_YET_TRIAL';
}


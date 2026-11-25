import type { PeriodDocument } from './model';

export function reimbursementDeadline(period: PeriodDocument, profileId: string): string {
  const extension = period.reimbursement_extension;
  if (extension?.profile_id !== profileId) return period.correction_deadline;
  const extended = Date.parse(extension.expires_at);
  const regular = Date.parse(period.correction_deadline);
  const end = Date.parse(period.ends_at);
  if (!Number.isFinite(extended) || extended <= regular || extended > end) return period.correction_deadline;
  return extension.expires_at;
}

export function reimbursementIsOpen(period: PeriodDocument, profileId: string, now: Date): boolean {
  return period.status === 'DRAFT' && now.getTime() < Date.parse(reimbursementDeadline(period, profileId));
}

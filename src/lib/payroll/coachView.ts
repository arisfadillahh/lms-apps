import { isPaid, type PeriodDocument } from './model';

const kinds = new Set(['CLASS_SUMMARY', 'WEEKLY', 'EKSKUL', 'TRIAL', 'EVENT', 'TRAINING_ONLINE', 'TRAINING_OFFLINE', 'OBSERVATION_ONLINE', 'OBSERVATION_OFFLINE']);

/** Explicit allowlist: financial records must never cross the coach attendance API. */
export function coachPeriodView(p: PeriodDocument, userId: string) {
  const slip = p.slips.find(s => s.user_id === userId);
  if (!slip) return null;
  return {
    id: p.id, status: p.status, starts_at: p.starts_at, ends_at: p.ends_at,
    correction_deadline: p.correction_deadline, calculated_at: p.calculated_at,
    activities: slip.lines.filter(l => kinds.has(l.kind) && (!l.summary || l.quantity > 0)).map(l => ({
      key: l.key, date: l.date, quantity: l.quantity, label: l.label.split(' — ')[0], kind: l.kind, students: l.students,
      status: l.details.includes('dibatalkan') ? 'Dibatalkan' : l.details.includes('Coach pengganti') ? 'Coach pengganti' : 'Tercatat',
    })),
    corrections: (p.corrections ?? []).filter(r => r.user_id === userId).map(r => ({
      id: r.id, at: r.at, message: r.message, status: r.status, response: r.response, reviewed_at: r.reviewed_at,
    })),
    slipUrl: p.status === 'FINAL' && isPaid(p, slip.profile_id) ? `/api/payroll/${p.id}/${slip.profile_id}/pdf` : null,
  };
}
export type CoachPeriodView = NonNullable<ReturnType<typeof coachPeriodView>>;

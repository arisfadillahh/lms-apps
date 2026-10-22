export interface BillingCycleInput {
  anchorEnd: string;
  durationMonths: number;
  month: number;
  year: number;
  today: string;
  enrolledAt: string;
  classStart: string;
  classEnd: string;
  lifecycle: string;
  periodStatus: string;
  /** A pause anywhere since the price/period anchor requires explicit admin review. */
  hasPauseSinceAnchor: boolean;
}

function date(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

/** Billing is independent of settlement. Never create access or guess a paused cycle. */
export function planInvoiceBillingCycle(input: BillingCycleInput): { start: string; end: string } | null {
  const anchor = date(input.anchorEnd), today = date(input.today);
  const classStart = date(input.classStart), classEnd = date(input.classEnd);
  const enrolled = date(input.enrolledAt.slice(0, 10));
  const { month, year, durationMonths: duration } = input;
  if (!anchor || !today || !classStart || !classEnd || !enrolled || !Number.isInteger(year)
    || year < 2020 || !Number.isInteger(month) || month < 1 || month > 12
    || !Number.isInteger(duration) || duration < 1 || duration > 24) return null;
  if (input.lifecycle !== 'ACTIVE' || !['ACTIVE', 'EXPIRED'].includes(input.periodStatus) || input.hasPauseSinceAnchor) return null;
  const delta = (year - anchor.getUTCFullYear()) * 12 + month - 1 - anchor.getUTCMonth();
  if (delta < 0 || delta % duration !== 0 || year * 12 + month > today.getUTCFullYear() * 12 + today.getUTCMonth() + 1) return null;
  const start = new Date(Date.UTC(year, month - 1, 26));
  const end = new Date(Date.UTC(year, month - 1 + duration, 25));
  // Class end limits the start of a new obligation; never charge a new cycle after it ended.
  if (start < classStart || start > classEnd || start < enrolled) return null;
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

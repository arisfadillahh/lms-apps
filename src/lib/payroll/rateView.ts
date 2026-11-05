import { DEFAULT_RATES, effective, type RateCard, type PayrollRates } from './model';

export const classRateRows = [
  { key: 'WEEKLY_ONLINE', label: 'Weekly', delivery: 'Online' },
  { key: 'WEEKLY_OFFLINE', label: 'Weekly', delivery: 'Offline' },
  { key: 'EKSKUL_ONLINE', label: 'Ekskul', delivery: 'Online' },
  { key: 'EKSKUL_OFFLINE', label: 'Ekskul', delivery: 'Offline' },
] as const;
export const activityRateRows = [
  { key: 'TRIAL', label: 'Trial', unit: 'per sesi' },
  { key: 'GOAL', label: 'Bonus goal trial', unit: 'per anak' },
  { key: 'EVENT', label: 'Event', unit: 'per kegiatan' },
  { key: 'TRAINING_ONLINE', label: 'Training online', unit: 'per kegiatan' },
  { key: 'TRAINING_OFFLINE', label: 'Training offline', unit: 'per kegiatan' },
  { key: 'OBSERVATION_ONLINE', label: 'Observasi online', unit: 'per kegiatan' },
  { key: 'OBSERVATION_OFFLINE', label: 'Observasi offline', unit: 'per kegiatan' },
] as const;

// The visible default must match the calculation engine, including future cards.
export function payrollRateView(cards: RateCard[], date: string, selectedDate = ''): { rates: PayrollRates; date: string | null; status: 'ACTIVE' | 'FUTURE' | 'PAST' | 'DEFAULT' } {
  const active = effective(cards, date);
  const selected = cards.find(c => c.effective_from === selectedDate) ?? active;
  return { rates: structuredClone(selected?.rates ?? DEFAULT_RATES), date: selected?.effective_from ?? null,
    status: !selected ? 'DEFAULT' : selected.effective_from > date ? 'FUTURE' : selected === active ? 'ACTIVE' : 'PAST' };
}

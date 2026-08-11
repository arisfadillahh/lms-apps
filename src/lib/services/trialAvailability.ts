export const TRIAL_AVAILABILITY_DAY_OPTIONS = [
  { value: 'MONDAY', label: 'Senin' },
  { value: 'TUESDAY', label: 'Selasa' },
  { value: 'WEDNESDAY', label: 'Rabu' },
  { value: 'THURSDAY', label: 'Kamis' },
  { value: 'FRIDAY', label: 'Jumat' },
  { value: 'SATURDAY', label: 'Sabtu' },
  { value: 'SUNDAY', label: 'Minggu' },
] as const;

export const TRIAL_AVAILABILITY_TIME_OPTIONS = [
  { value: '08:00', label: '08.00' },
  { value: '10:00', label: '10.00' },
  { value: '12:30', label: '12.30' },
  { value: '15:00', label: '15.00' },
  { value: '17:00', label: '17.00' },
  { value: '19:00', label: '19.00' },
] as const;

export type TrialAvailability = {
  days: string[];
  timeSlots: string[];
};

export function readTrialAvailability(value: unknown): TrialAvailability {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { days: [], timeSlots: [] };
  }

  const source = value as { availability?: unknown };
  if (!source.availability || typeof source.availability !== 'object' || Array.isArray(source.availability)) {
    return { days: [], timeSlots: [] };
  }

  const availability = source.availability as { days?: unknown; timeSlots?: unknown };
  return {
    days: Array.isArray(availability.days) ? availability.days.filter((item): item is string => typeof item === 'string') : [],
    timeSlots: Array.isArray(availability.timeSlots)
      ? availability.timeSlots.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

export function formatTrialAvailability(value: unknown) {
  const availability = readTrialAvailability(value);
  const dayLabels = availability.days.map((day) => TRIAL_AVAILABILITY_DAY_OPTIONS.find((option) => option.value === day)?.label ?? day);
  const timeLabels = availability.timeSlots.map((time) => TRIAL_AVAILABILITY_TIME_OPTIONS.find((option) => option.value === time)?.label ?? time);
  return {
    days: dayLabels,
    times: timeLabels,
    summary: dayLabels.length && timeLabels.length ? `${dayLabels.join(', ')} · mulai ${timeLabels.join(', ')}` : 'Belum diisi coach',
  };
}

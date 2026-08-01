export function normalizeIndonesianPhone(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function isValidIndonesianMobile(value: string) {
  return /^628\d{7,12}$/.test(normalizeIndonesianPhone(value));
}

export function formatIndonesianPhoneInput(value: string | null | undefined) {
  if (!value) return '';

  const normalized = normalizeIndonesianPhone(value);
  return normalized.startsWith('62') ? normalized.slice(2) : normalized;
}

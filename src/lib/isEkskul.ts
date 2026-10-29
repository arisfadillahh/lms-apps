/** Returns whether a class record belongs to the extracurricular program. */
export function isEkskulClass(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return 'type' in value && value.type === 'EKSKUL';
}

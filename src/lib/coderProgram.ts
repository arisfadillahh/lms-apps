export type CoderProgram = 'WEEKLY' | 'EKSKUL';

export function isCoderProgram(value: unknown): value is CoderProgram {
  return value === 'WEEKLY' || value === 'EKSKUL';
}

/**
 * Resolve a coder program from explicit user data, then the active class.
 * A phone number is deliberately not part of this resolver.
 */
export function resolveCoderProgram(
  storedProgram: unknown,
  activeClassType: unknown,
): CoderProgram | null {
  if (isCoderProgram(storedProgram)) return storedProgram;
  if (isCoderProgram(activeClassType)) return activeClassType;
  return null;
}

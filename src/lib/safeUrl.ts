import { z } from 'zod';

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

export function normalizeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeSafePageReference(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  return normalizeHttpUrl(trimmed);
}

export const httpUrlSchema = z.string().trim().max(2000).transform((value, context) => {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Tautan harus menggunakan http:// atau https://' });
    return z.NEVER;
  }
  return normalized;
});

export const optionalHttpUrlSchema = z.union([httpUrlSchema, z.literal(''), z.undefined()])
  .transform((value) => value || undefined);

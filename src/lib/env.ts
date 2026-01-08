import { getLocalhostFallback, normalizeLocalhostUrl } from '@/lib/runtimeUrl';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getAppBaseUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.PDF_BASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    getLocalhostFallback();

  const normalized = normalizeLocalhostUrl(candidate) ?? candidate;
  return trimTrailingSlash(normalized);
}

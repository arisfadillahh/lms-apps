export function getAppBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.PDF_BASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const fallback = 'http://localhost:3000';
  const value = base ?? fallback;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

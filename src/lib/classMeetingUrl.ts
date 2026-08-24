const PLACEHOLDER_HOSTS = new Set(['clev.io', 'www.clev.io']);

export function normalizeClassMeetingUrl(value: string | null | undefined): string | null {
  const rawValue = value?.trim();
  if (!rawValue) return null;

  let candidate = rawValue;
  if (/^https?:[^/]/i.test(candidate)) {
    candidate = candidate.replace(/^(https?):/i, '$1://');
  } else if (!/^[a-z][a-z\d+.-]*:/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;

    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.replace(/\/+$/, '').toLowerCase();
    if (PLACEHOLDER_HOSTS.has(hostname) && pathname === '/classroom') return null;

    return url.toString();
  } catch {
    return null;
  }
}

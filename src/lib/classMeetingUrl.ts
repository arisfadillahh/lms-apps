const PLACEHOLDER_HOSTS = new Set(['clev.io', 'www.clev.io']);
const CLEVIO_CLASSROOM_REDIRECT_PATH = '/Classroom';

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
    const pathname = url.pathname.replace(/\/+$/, '');
    // Clevio's classroom shortlink is case-sensitive and intentionally redirects
    // to the configured meeting room. Keep the canonical `/Classroom` path
    // usable while still rejecting the historical lowercase placeholder that
    // resolves to an LMS 404 page.
    if (PLACEHOLDER_HOSTS.has(hostname) && pathname.toLowerCase() === '/classroom' && pathname !== CLEVIO_CLASSROOM_REDIRECT_PATH) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

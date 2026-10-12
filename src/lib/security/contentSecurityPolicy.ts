const CONTENT_SECURITY_POLICY_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://*.midtrans.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
] as const;

export function shouldUpgradeInsecureRequests(appUrl: string | undefined): boolean {
  return !appUrl?.toLowerCase().startsWith('http://');
}

export function buildContentSecurityPolicy(options: { upgradeInsecureRequests?: boolean } = {}): string {
  const directives = options.upgradeInsecureRequests === false
    ? CONTENT_SECURITY_POLICY_DIRECTIVES.filter((directive) => directive !== 'upgrade-insecure-requests')
    : CONTENT_SECURITY_POLICY_DIRECTIVES;
  return directives.join('; ');
}

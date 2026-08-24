import 'server-only';

import crypto from 'node:crypto';

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function validateBearerToken(
  request: Request,
  configuredTokens: Array<string | undefined>,
): 'AUTHORIZED' | 'UNCONFIGURED' | 'INVALID' {
  const expectedTokens = configuredTokens.map((token) => token?.trim()).filter((token): token is string => Boolean(token));
  if (expectedTokens.length === 0) return 'UNCONFIGURED';

  const authorization = request.headers.get('authorization') || '';
  const actualToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!actualToken) return 'INVALID';

  return expectedTokens.some((expected) => safeEqual(actualToken, expected)) ? 'AUTHORIZED' : 'INVALID';
}

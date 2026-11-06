import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const REIMBURSEMENT_LINK_MAX_AGE_SECONDS = 35 * 24 * 3600;
export interface ReimbursementClaims { version: 1; profileId: string; periodId: string; issuedAt: number; expiresAt: number; nonce: string }
export class ReimbursementTokenError extends Error {}
function sign(payload: string, secret: string) { return createHmac('sha256', secret).update(`payroll-reimbursement:v1:${payload}`).digest(); }
function validateSecret(secret: string) { if (secret.length < 32) throw new ReimbursementTokenError('Konfigurasi tautan reimbursement belum tersedia.'); }

export function issueReimbursementToken(profileId: string, periodId: string, expiresAt: Date, secret: string, now = new Date()): string {
  validateSecret(secret);
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expires = Math.floor(expiresAt.getTime() / 1000);
  if (!uuid.test(profileId) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(periodId) || !Number.isFinite(expires) || expires <= issuedAt || expires - issuedAt > REIMBURSEMENT_LINK_MAX_AGE_SECONDS) throw new ReimbursementTokenError('Tautan reimbursement tidak valid atau sudah berakhir.');
  const claims: ReimbursementClaims = { version: 1, profileId, periodId, issuedAt, expiresAt: expires, nonce: randomBytes(18).toString('base64url') };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload, secret).toString('base64url')}`;
}

export function verifyReimbursementToken(token: string, secret: string, now = new Date()): ReimbursementClaims {
  validateSecret(secret);
  const fail = () => { throw new ReimbursementTokenError('Tautan reimbursement tidak valid atau sudah berakhir. Minta tautan baru kepada admin.'); };
  if (token.length > 1200 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return fail();
  const [payload, signature] = token.split('.');
  const expected = sign(payload, secret);
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return fail();
  let claims: ReimbursementClaims;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return fail(); }
  const time = Math.floor(now.getTime() / 1000);
  if (!claims || claims.version !== 1 || typeof claims.profileId !== 'string' || !uuid.test(claims.profileId) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(claims.periodId) || !Number.isSafeInteger(claims.issuedAt) || !Number.isSafeInteger(claims.expiresAt) || claims.issuedAt > time + 30 || claims.expiresAt <= time || claims.expiresAt <= claims.issuedAt || claims.expiresAt - claims.issuedAt > REIMBURSEMENT_LINK_MAX_AGE_SECONDS || !/^[A-Za-z0-9_-]{24}$/.test(claims.nonce)) return fail();
  return claims;
}

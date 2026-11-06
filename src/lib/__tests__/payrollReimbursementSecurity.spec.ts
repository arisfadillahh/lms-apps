import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { issueReimbursementToken, verifyReimbursementToken } from '@/lib/payroll/reimbursementToken';
import { MAX_REIMBURSEMENT_BODY_BYTES, prepareReimbursementImage, readReimbursementForm } from '@/lib/services/reimbursementImage';

const profileId = '20000000-0000-4000-8000-000000000001';
const secret = 'test-only-signing-secret-at-least-32-characters';
const now = new Date('2026-11-25T09:00:00+07:00');
const deadline = new Date('2026-11-25T17:00:00+07:00');

describe('scoped expiring payroll reimbursement tokens', () => {
  it('uses independent unguessable signatures with immutable recipient and period scope', () => {
    const first = issueReimbursementToken(profileId, '2026-11', deadline, secret, now);
    const second = issueReimbursementToken(profileId, '2026-11', deadline, secret, now);
    expect(first).not.toBe(second);
    expect(verifyReimbursementToken(first, secret, now)).toMatchObject({ profileId, periodId: '2026-11', expiresAt: deadline.getTime() / 1000, version: 1 });
    const [payload, signature] = first.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), profileId: '20000000-0000-4000-8000-000000000002' })).toString('base64url');
    expect(() => verifyReimbursementToken(`${forged}.${signature}`, secret, now)).toThrow(/tidak valid/);
    expect(() => verifyReimbursementToken(first, `${secret}-different`, now)).toThrow(/tidak valid/);
  });
  it('closes exactly at 17:00, rejects malformed tokens, and fails closed without a strong signing secret', () => {
    const token = issueReimbursementToken(profileId, '2026-11', deadline, secret, now);
    expect(() => verifyReimbursementToken(token, secret, new Date('2026-11-25T16:59:59+07:00'))).not.toThrow();
    expect(() => verifyReimbursementToken(token, secret, deadline)).toThrow(/berakhir/);
    expect(() => verifyReimbursementToken('bad.token', secret, now)).toThrow();
    expect(() => verifyReimbursementToken('a'.repeat(1500), secret, now)).toThrow();
    expect(() => issueReimbursementToken(profileId, '2026-11', deadline, 'weak', now)).toThrow(/Konfigurasi/);
    expect(() => issueReimbursementToken(profileId, '2026-11', new Date('2027-01-01'), secret, now)).toThrow();
    expect(() => issueReimbursementToken(profileId, '2026-13', deadline, secret, now)).toThrow();
  });
});

describe('bounded private reimbursement image ingestion', () => {
  it('decodes, reduces size, re-encodes to WebP and strips original metadata', async () => {
    const original = await sharp({ create: { width: 2200, height: 1100, channels: 3, background: '#e9a113' } }).jpeg().withMetadata({ exif: { IFD0: { Artist: 'private metadata' } } }).toBuffer();
    const result = await prepareReimbursementImage(new File([new Uint8Array(original)], '../../receipt.jpg', { type: 'image/jpeg' }));
    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe('webp'); expect(metadata.width).toBe(1600); expect(metadata.height).toBe(800);
    expect(metadata.exif).toBeUndefined(); expect(result.length).toBeLessThan(original.length);
  });
  it.each(['image/svg+xml', 'text/html', 'image/gif'])('rejects %s and never processes uploaded markup', async type => {
    await expect(prepareReimbursementImage(new File(['<svg onload="alert(1)"/>'], 'evidence.svg', { type }))).rejects.toThrow(/JPG, PNG, atau WebP/);
  });
  it('rejects spoofed, truncated and oversized files', async () => {
    await expect(prepareReimbursementImage(new File(['not a png'], 'bad.png', { type: 'image/png' }))).rejects.toThrow(/format/);
    await expect(prepareReimbursementImage(new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'bad.png', { type: 'image/png' }))).rejects.toThrow(/dibaca/);
    await expect(prepareReimbursementImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))).rejects.toMatchObject({ status: 413 });
  });
  it('enforces streamed body limits without relying on Content-Length', async () => {
    const request = new Request('http://localhost/api/payroll/reimbursement', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=test' }, body: new Uint8Array(MAX_REIMBURSEMENT_BODY_BYTES + 1) });
    await expect(readReimbursementForm(request)).rejects.toMatchObject({ status: 413 });
    await expect(readReimbursementForm(new Request('http://localhost', { method: 'POST', body: '{}' }))).rejects.toThrow(/formulir/);
  });
});

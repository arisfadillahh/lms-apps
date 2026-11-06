import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, submissionsOpen, validateReimbursement } from './formValidation';

const valid = { title: 'Alat kelas robotik', amount: '75000', photo: { type: 'image/jpeg', size: 12500 } };

describe('reimbursement form boundaries', () => {
  it('accepts each supported image type and the exact upper limits', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateReimbursement({ ...valid, amount: '1000000000', photo: { type, size: MAX_PHOTO_BYTES } })).toEqual({});
    }
  });
  it('rejects formatted, exponential, negative, fractional, zero, and excessive amounts', () => {
    for (const amount of ['75.000', '75,000', '1e5', '-10', '2.5', '0', '', '1000000001', '７５０００']) {
      expect(validateReimbursement({ ...valid, amount }).amount).toBeTruthy();
    }
  });
  it('requires meaningful titles and a nonempty image with allowed MIME and size', () => {
    expect(validateReimbursement({ ...valid, title: '  x  ', photo: null })).toMatchObject({ title: expect.any(String), photo: expect.any(String) });
    expect(validateReimbursement({ ...valid, title: 'x'.repeat(121) }).title).toBeTruthy();
    for (const photo of [{ type: 'image/svg+xml', size: 200 }, { type: 'application/pdf', size: 200 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: MAX_PHOTO_BYTES + 1 }]) {
      expect(validateReimbursement({ ...valid, photo }).photo).toBeTruthy();
    }
  });
  it('closes submissions at the exact deadline and respects the server flag', () => {
    const deadline = '2026-11-25T10:00:00.000Z';
    expect(submissionsOpen(true, deadline, Date.parse(deadline) - 1)).toBe(true);
    expect(submissionsOpen(true, deadline, Date.parse(deadline))).toBe(false);
    expect(submissionsOpen(true, deadline, Date.parse(deadline) + 1)).toBe(false);
    expect(submissionsOpen(false, deadline, Date.parse(deadline) - 1)).toBe(false);
    expect(submissionsOpen(true, 'invalid', 0)).toBe(false);
  });
});

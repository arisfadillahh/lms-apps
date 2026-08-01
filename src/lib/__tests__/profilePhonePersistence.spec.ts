import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  formatIndonesianPhoneInput,
  isValidIndonesianMobile,
  normalizeIndonesianPhone,
} from '@/lib/phoneNumbers';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('coach profile phone persistence', () => {
  it('normalizes common Indonesian phone formats for storage', () => {
    expect(normalizeIndonesianPhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeIndonesianPhone('+62 812 3456 7890')).toBe('6281234567890');
    expect(normalizeIndonesianPhone('81234567890')).toBe('6281234567890');
    expect(isValidIndonesianMobile('081234567890')).toBe(true);
  });

  it('maps the stored phone back to the +62 profile input', () => {
    expect(formatIndonesianPhoneInput('6281234567890')).toBe('81234567890');
    expect(formatIndonesianPhoneInput('081234567890')).toBe('81234567890');
  });

  it('loads, submits, normalizes, and persists the coach phone field', () => {
    const page = readSource('src/app/(coach)/coach/profile/page.tsx');
    const form = readSource('src/components/profile/ProfileForm.tsx');
    const route = readSource('src/app/api/profile/update/route.ts');

    expect(page).toContain('parentContactPhone: user.parent_contact_phone');
    expect(form).toContain('formatIndonesianPhoneInput(user.parentContactPhone)');
    expect(form).toContain('parentContactPhone: whatsapp.trim() ? normalizeIndonesianPhone(whatsapp) : null');
    expect(route).toContain('updatePayload.parent_contact_phone = data.parentContactPhone');
    expect(route).toContain('normalizeIndonesianPhone(data.parentContactPhone)');
  });
});

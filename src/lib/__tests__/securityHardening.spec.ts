import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeHttpUrl, normalizeSafePageReference } from '@/lib/safeUrl';
import { toPublicInvoice } from '@/lib/publicInvoice';
import type { Invoice } from '@/lib/types/invoice';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('security hardening invariants', () => {
  it('rejects executable URL protocols while preserving HTTP(S) and LMS paths', () => {
    expect(normalizeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeSafePageReference('//evil.example/path')).toBeNull();
    expect(normalizeSafePageReference('/coder/materials')).toBe('/coder/materials');
    expect(normalizeHttpUrl('https://lms.clev.io/login')).toBe('https://lms.clev.io/login');
  });

  it('does not expose raw provider payloads or internal payment identifiers publicly', () => {
    const invoice = {
      id: 'invoice-1', invoice_number: 'INV-1', ccr_id: null, parent_phone: '6281', parent_name: 'Parent',
      period_month: 8, period_year: 2026, period_start_date: '2026-08-01', period_end_date: '2026-08-31',
      total_amount: 500000, status: 'PENDING', invoice_type: 'MONTHLY', due_date: '2026-08-31', paid_at: null,
      paid_notes: 'internal', selected_payment_attempt_id: 'attempt-1', midtrans_transaction_id: 'transaction-1',
      midtrans_raw_response: { signature_key: 'must-not-leak' }, created_at: '2026-08-01', updated_at: '2026-08-01',
      items: [],
    } as Invoice;
    const publicInvoice = toPublicInvoice(invoice) as unknown as Record<string, unknown>;
    expect(publicInvoice).not.toHaveProperty('midtrans_raw_response');
    expect(publicInvoice).not.toHaveProperty('midtrans_transaction_id');
    expect(publicInvoice).not.toHaveProperty('selected_payment_attempt_id');
    expect(publicInvoice).not.toHaveProperty('paid_notes');
  });

  it('revokes browser database access and makes payment webhooks idempotent', () => {
    const migration = read('supabase/migrations/20260824133000_security_hardening.sql');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('from anon, authenticated');
    expect(migration).toContain('claim_midtrans_webhook_event');
    expect(migration).toContain("return 'DUPLICATE'");
  });

  it('keeps push notifications scoped to the active browser account', () => {
    const serviceWorker = read('public/sw.js');
    expect(serviceWorker).toContain("event.data?.type !== 'SET_ACTIVE_USER'");
    expect(serviceWorker).toContain('if (!activeUserId || activeUserId !== String(payload.recipientUserId)) return');
  });

  it('requires ownership for notification mutation and rejects production class reset', () => {
    expect(read('src/lib/dao/notificationsDao.ts')).toContain(".eq('user_id', userId)");
    expect(read('src/app/api/admin/dev/reset-classes/route.ts')).toContain("process.env.NODE_ENV === 'production'");
  });

  it('backs up legacy issue screenshots before removing public objects', () => {
    const migration = read('scripts/security/migrate-issue-screenshots.mjs');
    expect(migration).toContain("if (!APPLY)");
    expect(migration).toContain('await writeBackup(rows, objects)');
    expect(migration).toContain('verification.buffer.length !== object.buffer.length');
    expect(migration).toContain('await restoreFromManifest(supabase, backup.manifestPath)');
  });
});

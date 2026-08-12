import { describe, expect, it } from 'vitest';

import {
  buildIssueReportWhatsAppMessage,
  formatIssueReportReference,
  getIssueScreenshotExtension,
  issueReportSchema,
  issueReportUpdateSchema,
} from '@/lib/issueReports';

describe('issue report helpers', () => {
  it('creates a short stable reference', () => {
    expect(formatIssueReportReference('a1b2c3d4-1111-2222-3333-444455556666')).toBe('BUG-A1B2C3D4');
  });

  it('only accepts supported screenshot mime types', () => {
    expect(getIssueScreenshotExtension('image/png')).toBe('png');
    expect(getIssueScreenshotExtension('image/jpeg')).toBe('jpg');
    expect(getIssueScreenshotExtension('image/gif')).toBeNull();
  });

  it('validates the public report fields', () => {
    expect(issueReportSchema.safeParse({ title: 'Error nilai', description: 'Tombol simpan tidak merespons.' }).success).toBe(true);
    expect(issueReportSchema.safeParse({ title: 'Err', description: 'Pendek' }).success).toBe(false);
  });

  it('requires a resolution summary before closing', () => {
    expect(issueReportUpdateSchema.safeParse({ status: 'RESOLVED', priority: 'HIGH', resolutionSummary: '' }).success).toBe(false);
    expect(issueReportUpdateSchema.safeParse({ status: 'RESOLVED', priority: 'HIGH', resolutionSummary: 'Data stale sudah diperbaiki.' }).success).toBe(true);
  });

  it('formats a readable WhatsApp caption with troubleshooting context', () => {
    const message = buildIssueReportWhatsAppMessage({
      id: 'a1b2c3d4-1111-2222-3333-444455556666',
      reporterName: 'Coach Test',
      reporterRole: 'COACH',
      title: 'Tombol simpan tidak merespons',
      description: 'Terjadi setelah melengkapi seluruh penilaian.',
      pageUrl: 'https://lms.clev.io/coach/rubrics/example',
      createdAt: '2026-08-12T03:00:00.000Z',
      hasScreenshot: true,
    });

    expect(message).toContain('*LAPORAN MASALAH LMS*');
    expect(message).toContain('BUG-A1B2C3D4');
    expect(message).toContain('Coach Test (Coach)');
    expect(message).toContain('Screenshot terlampir');
    expect(message).toContain('/admin/issue-reports');
  });

  it('supports admin reporters', () => {
    const message = buildIssueReportWhatsAppMessage({
      id: 'a1b2c3d4-1111-2222-3333-444455556666',
      reporterName: 'Admin Test',
      reporterRole: 'ADMIN',
      title: 'Halaman admin gagal dibuka',
      description: 'Halaman berhenti saat memuat data.',
      createdAt: '2026-08-12T03:00:00.000Z',
      hasScreenshot: false,
    });

    expect(message).toContain('Admin Test (Admin)');
  });
});

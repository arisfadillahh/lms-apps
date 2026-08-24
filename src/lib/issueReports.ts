import { z } from 'zod';
import { normalizeSafePageReference } from '@/lib/safeUrl';

export const ISSUE_REPORT_WHATSAPP_NUMBER = process.env.ISSUE_REPORT_WHATSAPP_NUMBER || '6281212022628';
export const ISSUE_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export type IssueReporterRole = 'ADMIN' | 'COACH' | 'CODER';

export const issueReportSchema = z.object({
  title: z.string().trim().min(5, 'Judul minimal 5 karakter').max(120, 'Judul maksimal 120 karakter'),
  description: z.string().trim().min(10, 'Deskripsi minimal 10 karakter').max(3000, 'Deskripsi maksimal 3000 karakter'),
  pageUrl: z.string().trim().max(1000).optional().default('').transform((value, context) => {
    if (!value) return '';
    const normalized = normalizeSafePageReference(value);
    if (!normalized) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Halaman harus berupa path LMS atau URL http(s)' });
      return z.NEVER;
    }
    return normalized;
  }),
  viewportWidth: z.coerce.number().int().positive().max(10000).optional(),
  viewportHeight: z.coerce.number().int().positive().max(10000).optional(),
});

export const issueReportUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  adminNotes: z.string().trim().max(3000).optional().default(''),
  resolutionSummary: z.string().trim().max(3000).optional().default(''),
}).superRefine((value, ctx) => {
  if ((value.status === 'RESOLVED' || value.status === 'CLOSED') && value.resolutionSummary.length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['resolutionSummary'],
      message: 'Ringkasan penyelesaian minimal 10 karakter untuk menutup report',
    });
  }
});

export function getIssueScreenshotExtension(contentType: string): string | null {
  return ({
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  } as Record<string, string>)[contentType] ?? null;
}

export function formatIssueReportReference(id: string): string {
  return `BUG-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

export function buildIssueReportWhatsAppMessage(input: {
  id: string;
  reporterName: string;
  reporterRole: IssueReporterRole;
  title: string;
  description: string;
  pageUrl?: string | null;
  createdAt: string;
  hasScreenshot: boolean;
}): string {
  const roleLabel = input.reporterRole === 'ADMIN' ? 'Admin' : input.reporterRole === 'COACH' ? 'Coach' : 'Coder';
  const time = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(input.createdAt));

  return [
    '*LAPORAN MASALAH LMS*',
    '',
    `ID: ${formatIssueReportReference(input.id)}`,
    `Pelapor: ${input.reporterName} (${roleLabel})`,
    `Waktu: ${time} WIB`,
    `Judul: ${input.title}`,
    input.pageUrl ? `Halaman: ${input.pageUrl}` : null,
    '',
    '*Deskripsi:*',
    input.description,
    '',
    input.hasScreenshot ? 'Screenshot terlampir pada pesan ini.' : 'Tidak ada screenshot yang dilampirkan.',
    '',
    `Tindak lanjuti di: ${process.env.NEXTAUTH_URL || 'https://lms.clev.io'}/admin/issue-reports`,
  ].filter((line): line is string => line !== null).join('\n');
}

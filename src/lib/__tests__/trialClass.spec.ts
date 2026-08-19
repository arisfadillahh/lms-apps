import { describe, expect, it } from 'vitest';

import {
  buildTrialClassAdminMessage,
  buildTrialClassParentMessage,
  buildTrialCoachAssignmentWebsiteMessage,
  buildTrialCoachAssignmentWhatsAppMessage,
  buildTrialConversionAdminMessage,
  type TrialCoachAssignmentNotificationInput,
  type TrialClassNotificationInput,
} from '@/lib/services/trialClassNotifications';
import { normalizeIndonesianPhone, trialClassSchema } from '@/lib/validation/trialClass';

const validSubmission = {
  studentName: 'Alya Putri',
  studentGrade: '4 SD',
  schoolName: 'SD Clevio',
  parentName: 'Budi Putra',
  phone: '0812 1202 2628',
  email: 'budi@example.com',
  trialMode: 'ONLINE' as const,
  notes: 'Sabtu pagi',
  website: '',
};

const notificationInput: TrialClassNotificationInput = {
  id: 'trial-id',
  studentName: 'Alya Putri',
  studentGrade: '4 SD',
  schoolName: 'SD Clevio',
  parentName: 'Budi Putra',
  phone: '6281212022628',
  email: 'budi@example.com',
  trialMode: 'ONLINE',
  notes: 'Sabtu pagi',
  createdAt: '2026-07-14T08:00:00.000Z',
};

const coachAssignmentInput: TrialCoachAssignmentNotificationInput = {
  coachId: 'coach-id',
  coachName: 'Dede Coach',
  coachPhone: '081234567890',
  studentName: 'Alya Putri',
  studentGrade: '4 SD',
  schoolName: 'SD Clevio',
  trialMode: 'ONLINE',
  notes: 'Suka belajar visual',
  scheduledAt: '2026-07-30T03:00:00.000Z',
  durationMinutes: 60,
  meetUrl: 'https://meet.google.com/abc-defg-hij',
};

describe('trial class validation', () => {
  it('accepts a complete trial class submission', () => {
    const result = trialClassSchema.safeParse(validSubmission);

    expect(result.success).toBe(true);
  });

  it('rejects invalid phone and email values', () => {
    const result = trialClassSchema.safeParse({
      ...validSubmission,
      phone: '1234',
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.phone?.[0]).toContain('Nomor telepon');
      expect(errors.email?.[0]).toContain('email');
    }
  });

  it('allows an empty schedule preference', () => {
    const result = trialClassSchema.safeParse({
      ...validSubmission,
      notes: '',
    });

    expect(result.success).toBe(true);
  });

  it('accepts offline trial selection', () => {
    const result = trialClassSchema.safeParse({
      ...validSubmission,
      trialMode: 'OFFLINE',
    });

    expect(result.success).toBe(true);
  });

  it('normalizes Indonesian phone numbers for WhatsApp links', () => {
    expect(normalizeIndonesianPhone('0812-1202-2628')).toBe('6281212022628');
    expect(normalizeIndonesianPhone('+62 812 1202 2628')).toBe('6281212022628');
    expect(normalizeIndonesianPhone('81212022628')).toBe('6281212022628');
  });
});

describe('trial coach assignment notifications', () => {
  it('includes the schedule and Google Meet link in the coach WhatsApp reminder', () => {
    const message = buildTrialCoachAssignmentWhatsAppMessage(coachAssignmentInput);

    expect(message).toContain('*Assignment Trial Class Baru*');
    expect(message).toContain('*Peserta:* Alya Putri');
    expect(message).toContain('*Jadwal:* Kamis, 30 Juli 2026, pukul 10.00 WIB');
    expect(message).toContain('*Google Meet:* https://meet.google.com/abc-defg-hij');
    expect(message).toContain('https://lms.clev.io/coach/dashboard');
  });

  it('creates a clickable and HTML-safe website notification', () => {
    const message = buildTrialCoachAssignmentWebsiteMessage({
      ...coachAssignmentInput,
      studentName: '<script>alert(1)</script>',
    });

    expect(message).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(message).not.toContain('<script>');
    expect(message).toContain('href="https://meet.google.com/abc-defg-hij"');
    expect(message).toContain('Masuk Google Meet');
  });

  it('does not include a Meet link for an offline assignment', () => {
    const message = buildTrialCoachAssignmentWhatsAppMessage({
      ...coachAssignmentInput,
      trialMode: 'OFFLINE',
      meetUrl: null,
    });

    expect(message).toContain('*Jenis trial:* Offline');
    expect(message).not.toContain('*Google Meet:*');
  });
});

describe('trial class WhatsApp notifications', () => {
  it('includes complete lead details in the admin group message', () => {
    const message = buildTrialClassAdminMessage(notificationInput);

    expect(message).toContain('*Lead Free Trial Baru*');
    expect(message).toContain('*Anak:* Alya Putri');
    expect(message).toContain('*WA:* 6281212022628');
    expect(message).toContain('*Jenis trial:* Online');
    expect(message).toContain('*Preferensi jadwal:* Sabtu pagi');
    expect(message).toContain('https://lms.clev.io/admin/free-trials');
  });

  it('confirms schedule follow-up to the parent', () => {
    const message = buildTrialClassParentMessage(notificationInput);

    expect(message).toContain('Halo Ayah/Bunda Budi Putra');
    expect(message).toContain('Free Trial Class Clevio');
    expect(message).toContain('Mohon menunggu, tim Clevio akan menghubungi');
    expect(message).toContain('menyiapkan laptop dan koneksi internet yang stabil');
    expect(message).not.toContain('*Preferensi jadwal:*');
  });

  it('omits schedule, location, and notes from offline parent notifications', () => {
    const message = buildTrialClassParentMessage({
      ...notificationInput,
      trialMode: 'OFFLINE',
      notes: 'Sabtu pertama bulan depan',
    });

    expect(message).toContain('*Jenis trial:* Offline');
    expect(message).not.toContain('*Jadwal:*');
    expect(message).not.toContain('*Lokasi:*');
    expect(message).not.toContain('*Catatan:*');
    expect(message).not.toContain('Bukit Golf Riverside');
  });

  it('omits the offline schedule and location from the admin group message', () => {
    const message = buildTrialClassAdminMessage({
      ...notificationInput,
      trialMode: 'OFFLINE',
      notes: 'Perlu laptop pinjaman',
    });

    expect(message).toContain('*Jenis trial:* Offline');
    expect(message).toContain('*Catatan:* Perlu laptop pinjaman');
    expect(message).not.toContain('*Jadwal:*');
    expect(message).not.toContain('*Lokasi:*');
    expect(message).not.toContain('Bukit Golf Riverside');
  });
});

describe('trial conversion notifications', () => {
  it('clearly tells Admin to create the LMS account manually after payment', () => {
    const message = buildTrialConversionAdminMessage({
      assessmentId: 'assessment-id',
      studentName: 'Alya Putri',
      parentName: 'Budi Putra',
      parentPhone: '6281212022628',
      recommendedLevel: 'Creator',
      invoiceNumber: 'INV-TRIAL-001',
      totalAmount: 500000,
    });

    expect(message).toContain('*Trial berhasil daftar setelah pembayaran*');
    expect(message).toContain('Akun LMS belum dibuat otomatis');
    expect(message).toContain('Buat akun LMS secara manual');
    expect(message).toContain('assign coder ke kelas Weekly');
    expect(message).not.toContain('Username LMS');
  });
});

import { describe, expect, it } from 'vitest';
import { createPeriod, type PayrollLine, type PayrollMeeting, type Slip } from '@/lib/payroll/model';
import { attendanceRecapBlockReason, formatAttendanceRecap, formatAttendanceReminder } from '@/lib/payroll/attendanceMessage';

const period = createPeriod(2026, 11);
const slip = (patch: Partial<Slip> = {}): Slip => ({ profile_id: 'p1', user_id: 'u1', name: 'Coach Alsa', job_title: 'Coach', kind: 'COACH', contract: 'MITRA', total: 780000, lines: [], ...patch });
const meeting = (patch: Partial<PayrollMeeting> = {}): PayrollMeeting => ({ key: 'session-1', user_id: 'u1', date: '2026-11-04T08:00:00Z', label: 'Weekly Scratch', kind: 'WEEKLY', delivery: 'ONLINE', students: 2, cancelled: false, ...patch });
const line = (patch: Partial<PayrollLine> = {}): PayrollLine => ({ key: 'session-1', date: '2026-11-04T08:00:00Z', label: 'Weekly Scratch', kind: 'WEEKLY', quantity: 1, rate: 80000, amount: 80000, details: '', ...patch });

describe('simple dated coach attendance message', () => {
  it('groups real meetings in WIB, includes replacements, and keeps financial details private', () => {
    const coach = slip({ attendance_details: [
      meeting({ key: 'session-2', date: '2026-11-05T03:30:00Z', label: 'Ekskul Robotik', substitute: true }),
      meeting(),
      meeting({ key: 'session-3', date: '2026-11-04T09:00:00Z', label: 'Trial Dira', kind: 'TRIAL' }),
    ], lines: [line({ label: 'Gaji rahasia', kind: 'SALARY', amount: 7000000 }), line({ label: 'Bonus rahasia', kind: 'GOAL' }), line({ label: 'Tunjangan rahasia', kind: 'ALLOWANCE' })] });
    const message = formatAttendanceRecap(period, coach, new Date(), 'https://lms.clev.io');
    expect(message).toContain('Rekap mengajar - November 2026');
    expect(message).toContain('4 Nov\n• 15.00 - Weekly Scratch\n• 16.00 - Trial Dira\n\n5 Nov\n• 10.30 - Ekskul Robotik (pengganti)');
    expect(message).toContain('Total: 3 aktivitas.');
    expect(message).toContain('BATAS KOREKSI: 25 November 2026 pukul 17.00 WIB.');
    expect(message).toContain('Kalau ada yang perlu dikoreksi, ajukan di LMS sebelum batas itu.');
    expect(message).toContain('https://lms.clev.io/coach/payroll?period=2026-11');
    expect(message).not.toMatch(/Rp|80[.,]?000|780[.,]?000|gaji|fee|bonus|tunjangan|n8n|sistem lama/i);
  });

  it('keeps cancellations visible without counting them as completed activities and deduplicates session keys', () => {
    const coach = slip({ attendance_details: [meeting(), meeting(), meeting({ key: 'cancelled', label: 'Weekly Batal', cancelled: true })] });
    const message = formatAttendanceRecap(period, coach);
    expect(message.match(/Weekly Scratch/g)).toHaveLength(1);
    expect(message).toContain('Weekly Batal (dibatalkan)');
    expect(message).toContain('Total: 1 aktivitas.');
  });

  it('derives older native session/activity details without leaking non-attendance lines', () => {
    const coach = slip({ lines: [line({ details: 'Coach pengganti · Tidak menghasilkan tambahan fee' }), line({ key: 'event', date: '2026-11-03', label: 'Event Robotik', kind: 'EVENT' }), ...['SALARY', 'ALLOWANCE', 'ADJUSTMENT', 'GOAL', 'TRANSPORT'].map(kind => line({ key: kind, kind, label: `RAHASIA ${kind}` }))] });
    expect(attendanceRecapBlockReason(coach)).toBeNull();
    const message = formatAttendanceRecap(period, coach);
    expect(message).toContain('3 Nov\n• Event Robotik');
    expect(message).toContain('4 Nov\n• 15.00 - Weekly Scratch (pengganti)');
    expect(message).toContain('Total: 2 aktivitas.');
    expect(message).not.toContain('RAHASIA');
    expect(message).not.toContain('Tidak menghasilkan');
  });

  it.each([
    { unresolved_attendance: 2, attendance_details: [meeting()] },
    { lines: [line({ date: '', kind: 'CLASS_SUMMARY', summary: true, quantity: 4 })] },
    { lines: [line({ date: '2026-11-04T08:00:00Z', summary: true, quantity: 4 })] },
    { attendance_details: [meeting({ date: '2026-02-30T08:00:00Z' })] },
    { attendance_details: [meeting({ label: '   ' })] },
  ] satisfies Partial<Slip>[])('blocks missing or fictional meeting details instead of presenting an incomplete message: %j', patch => {
    const coach = slip(patch);
    expect(attendanceRecapBlockReason(coach)).toContain('Rekap belum dapat dikirim');
    expect(formatAttendanceRecap(period, coach)).toBe(attendanceRecapBlockReason(coach));
    expect(formatAttendanceReminder(period, coach)).toBe(attendanceRecapBlockReason(coach));
  });

  it('treats explicit meeting details as authoritative when aggregate financial lines are still present', () => {
    const coach = slip({ attendance_details: [meeting()], unresolved_attendance: 0, lines: [line({ summary: true, date: '', quantity: 1 })] });
    expect(attendanceRecapBlockReason(coach)).toBeNull();
    expect(formatAttendanceRecap(period, coach)).toContain('15.00 - Weekly Scratch');
  });

  it('uses a short reminder with the same single deadline and no activity list or money', () => {
    const coach = slip({ attendance_details: [meeting()] });
    const message = formatAttendanceReminder(period, coach, 'https://lms.clev.io');
    expect(message).toContain('Pengingat rekap mengajar - November 2026');
    expect(message).toContain('BATAS KOREKSI: 25 November 2026 pukul 17.00 WIB.');
    expect(message.match(/17\.00/g)).toHaveLength(1);
    expect(message).not.toMatch(/Weekly Scratch|Rp|fee|gaji/i);
    expect(message.length).toBeLessThan(formatAttendanceRecap(period, coach, new Date(), 'https://lms.clev.io').length);
  });

  it.each(['javascript:alert(1)', 'https://user:secret@evil.example', 'http://public.example', 'bad url'])('omits unsafe app URL %s', url => {
    const message = formatAttendanceRecap(period, slip(), new Date(), url);
    expect(message).not.toContain('Buka rekap:');
    expect(message).not.toContain('secret');
  });

  it('handles no attendance and builds the link only from the configured origin', () => {
    const message = formatAttendanceRecap(period, slip(), new Date(), 'https://lms.clev.io/admin?redirect=https://bad.example');
    expect(message).toContain('Belum ada aktivitas tercatat.');
    expect(message).toContain('Total: 0 aktivitas.');
    expect(message).toContain('https://lms.clev.io/coach/payroll?period=2026-11');
    expect(message).not.toContain('bad.example');
  });
});

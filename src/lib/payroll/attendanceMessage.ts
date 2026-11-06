import type { PayrollMeeting, PeriodDocument, Slip } from './model';

const attendanceKinds = new Set(['WEEKLY', 'EKSKUL', 'TRIAL', 'EVENT', 'TRAINING_ONLINE', 'TRAINING_OFFLINE', 'OBSERVATION_ONLINE', 'OBSERVATION_OFFLINE', 'CLASS_SUMMARY']);
const timeZone = 'Asia/Jakarta';
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

function activityDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  if (!Number.isFinite(date.getTime())) return null;
  // Date normalizes invalid calendar days, which must not become invented meetings.
  const sourceDay = value.slice(0, 10);
  const [year, month, day] = sourceDay.split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return calendar.toISOString().slice(0, 10) === sourceDay ? date : null;
}

function fallbackLines(slip: Slip) {
  return slip.lines.filter(line => attendanceKinds.has(line.kind) && line.quantity > 0);
}

/** Delivery must stop until every cumulative attendance count has real meeting details. */
export function attendanceRecapBlockReason(slip: Slip): string | null {
  const unresolved = slip.unresolved_attendance ?? 0;
  if (unresolved > 0) return `Rekap belum dapat dikirim: ${unresolved} aktivitas belum memiliki tanggal dan nama kelas. Lengkapi pertemuannya di rincian penerima terlebih dahulu.`;
  if (slip.attendance_details !== undefined) {
    if (slip.attendance_details.some(meeting => !activityDate(meeting.date) || !clean(meeting.label))) return 'Rekap belum dapat dikirim: ada pertemuan dengan tanggal atau nama kelas yang belum lengkap. Perbaiki rincian penerima terlebih dahulu.';
    return null;
  }
  const incomplete = fallbackLines(slip).filter(line => line.summary || line.kind === 'CLASS_SUMMARY' || line.quantity !== 1 || !activityDate(line.date) || !clean(line.label));
  if (incomplete.length) return 'Rekap belum dapat dikirim: jumlah aktivitas belum dilengkapi tanggal dan nama kelas per pertemuan. Lengkapi pertemuannya di rincian penerima terlebih dahulu.';
  return null;
}

function meetingsForMessage(slip: Slip): PayrollMeeting[] {
  const meetings = slip.attendance_details ?? fallbackLines(slip)
    .filter(line => !line.summary && line.kind !== 'CLASS_SUMMARY' && line.quantity === 1)
    .map(line => ({ key: line.key, date: line.date, label: line.label, user_id: slip.user_id ?? '', kind: line.kind as PayrollMeeting['kind'], delivery: 'ONLINE' as const, students: line.students ?? 0, cancelled: /dibatalkan/i.test(line.details), substitute: /coach pengganti/i.test(line.details) }));
  const seen = new Set<string>();
  return meetings.filter(meeting => {
    if (seen.has(meeting.key) || !activityDate(meeting.date) || !clean(meeting.label)) return false;
    seen.add(meeting.key);
    return true;
  }).sort((a, b) => activityDate(a.date)!.getTime() - activityDate(b.date)!.getTime() || a.label.localeCompare(b.label, 'id'));
}

function monthLabel(period: PeriodDocument) {
  return new Date(Date.UTC(period.year, period.month - 1, 1)).toLocaleDateString('id-ID', { timeZone, month: 'long', year: 'numeric' });
}

function deadlineLabel(period: PeriodDocument) {
  return new Date(period.correction_deadline).toLocaleDateString('id-ID', { timeZone, day: 'numeric', month: 'long', year: 'numeric' });
}

function coachLink(period: PeriodDocument, appUrl?: string): string {
  if (!appUrl) return '';
  try {
    const base = new URL(appUrl);
    if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) return '';
    const link = new URL('/coach/payroll', base.origin);
    link.searchParams.set('period', period.id);
    return `\nBuka rekap: ${link.toString()}`;
  } catch { return ''; }
}

export function formatAttendanceRecap(period: PeriodDocument, slip: Slip, _now?: Date, appUrl?: string): string {
  const blocked = attendanceRecapBlockReason(slip);
  if (blocked) return blocked;
  const meetings = meetingsForMessage(slip);
  const count = meetings.filter(meeting => !meeting.cancelled).length;
  let lastDay = '';
  const rows: string[] = [];
  for (const meeting of meetings) {
    const date = activityDate(meeting.date)!;
    const day = date.toLocaleDateString('id-ID', { timeZone, day: 'numeric', month: 'short' });
    if (day !== lastDay) { rows.push(`${rows.length ? '\n' : ''}${day}`); lastDay = day; }
    const time = meeting.date.length === 10 ? '' : `${date.toLocaleTimeString('id-ID', { timeZone, hour: '2-digit', minute: '2-digit' })} - `;
    const status = meeting.cancelled ? ' (dibatalkan)' : meeting.substitute ? ' (pengganti)' : '';
    rows.push(`• ${time}${clean(meeting.label)}${status}`);
  }
  return `Rekap mengajar - ${monthLabel(period)}\nHalo ${clean(slip.name)}, ini aktivitas yang tercatat di LMS.\n\n${rows.join('\n') || 'Belum ada aktivitas tercatat.'}\n\nTotal: ${count} aktivitas.\n\nBATAS KOREKSI: ${deadlineLabel(period)} pukul 17.00 WIB.\nKalau ada yang perlu dikoreksi, ajukan di LMS sebelum batas itu.\nKelas tanggal 25 yang berjalan setelah pesan ini tetap masuk periode ini.${coachLink(period, appUrl)}`;
}

export function formatAttendanceReminder(period: PeriodDocument, slip: Slip, appUrl?: string): string {
  const blocked = attendanceRecapBlockReason(slip);
  if (blocked) return blocked;
  return `Pengingat rekap mengajar - ${monthLabel(period)}\nHalo ${clean(slip.name)}, pastikan rekap mengajarmu sudah sesuai.\n\nBATAS KOREKSI: ${deadlineLabel(period)} pukul 17.00 WIB.\nKalau ada yang perlu dikoreksi, ajukan di LMS sebelum batas itu.${coachLink(period, appUrl)}`;
}

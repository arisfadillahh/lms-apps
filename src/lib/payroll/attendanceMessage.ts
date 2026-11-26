import type { PayrollMeeting, PeriodDocument, Slip } from './model';
import { attendanceStatusLabel, projectStudentAttendance } from './studentAttendanceState.ts';
import { MOTOR_TRIP_OPENING_PREFIX } from './transport.ts';

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
    .map(line => ({ key: line.key, date: line.date, label: line.label, user_id: slip.user_id ?? '', kind: line.kind as PayrollMeeting['kind'], delivery: 'ONLINE' as const, students: line.students ?? 0, cancelled: /dibatalkan/i.test(line.details), substitute: /coach pengganti/i.test(line.details), ...projectStudentAttendance(line) }));
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

export function formatAttendanceRecap(period: PeriodDocument, slip: Slip, now?: Date, appUrl?: string): string {
  const blocked = attendanceRecapBlockReason(slip);
  if (blocked) return blocked;
  const meetings = meetingsForMessage(slip);
  const count = meetings.filter(meeting => !meeting.cancelled && meeting.fee_eligible !== false).length;
  let lastDay = '';
  const rows: string[] = [];
  for (const meeting of meetings) {
    const date = activityDate(meeting.date)!;
    const day = date.toLocaleDateString('id-ID', { timeZone, day: 'numeric', month: 'short' });
    if (day !== lastDay) { rows.push(`${rows.length ? '\n' : ''}${day}`); lastDay = day; }
    const time = meeting.date.length === 10 ? '' : `${date.toLocaleTimeString('id-ID', { timeZone, hour: '2-digit', minute: '2-digit' })} - `;
    const attendanceLabel = attendanceStatusLabel(meeting);
    const status = meeting.cancelled ? ' (dibatalkan)' : [meeting.substitute ? 'pengganti' : '', attendanceLabel?.toLocaleLowerCase('id-ID') ?? ''].filter(Boolean).map(label => ` (${label})`).join('');
    rows.push(`• ${time}${clean(meeting.label)}${status}`);
  }
  const trips = slip.lines.filter(line => line.kind === 'TRANSPORT' && line.key.startsWith('transport-motor:'));
  const opening = slip.lines.find(line => line.key.startsWith(`component:${MOTOR_TRIP_OPENING_PREFIX}`));
  const transport = [
    opening ? `\n${clean(opening.label)}.` : '',
    trips.length ? `\nTransport motor terkonfirmasi: ${trips.length} trip.` : '',
  ].join('');
  const correction = now && now.getTime() >= Date.parse(period.correction_deadline)
    ? 'Kalau ada aktivitas atau perjalanan yang perlu dicek, hubungi admin.\nSeluruh kegiatan tanggal 25 tetap masuk periode ini.'
    : `BATAS KOREKSI: ${deadlineLabel(period)} pukul 17.00 WIB.\nKalau ada yang perlu dikoreksi, ajukan di LMS sebelum batas itu.\nKelas tanggal 25 yang berjalan setelah pesan ini tetap masuk periode ini.`;
  return `Rekap mengajar - ${monthLabel(period)}\nHalo ${clean(slip.name)}, ini aktivitas yang tercatat di LMS.\n\n${rows.join('\n') || 'Belum ada aktivitas tercatat.'}\n\nTotal: ${count} aktivitas.${transport}\n\n${correction}${coachLink(period, appUrl)}`;
}

export function formatStaffRecap(period: PeriodDocument, slip: Slip): string {
  const activities = slip.lines.filter(line =>
    attendanceKinds.has(line.kind) || line.kind === 'TRANSPORT'
    || (line.kind === 'ADJUSTMENT' && /transport|reimbursement|ongkos/i.test(line.label)),
  );
  const rows = activities.map(line => {
    const date = activityDate(line.date);
    return `• ${date ? date.toLocaleDateString('id-ID', { timeZone, day: 'numeric', month: 'short' }) + ' · ' : ''}${clean(line.label)}`;
  });
  return `Rekap staf - ${monthLabel(period)}\nHalo ${clean(slip.name)}, ini ringkasan aktivitas dan transport di LMS.\n\n${rows.join('\n') || 'Belum ada aktivitas atau transport tercatat untuk periode ini.'}\n\nKalau ada catatan yang perlu dilengkapi, hubungi admin.`;
}

export function formatCoachRecapNotice(
  period: PeriodDocument,
  name: string,
  now: Date,
  appUrl: string | undefined,
  reminder: boolean,
): string {
  const heading = reminder ? 'Pengingat rekap mengajar' : 'Rekap mengajar';
  const correction = now.getTime() < Date.parse(period.correction_deadline)
    ? `Ajukan koreksi paling lambat ${deadlineLabel(period)} pukul 17.00 WIB.`
    : 'Hubungi admin jika ada yang perlu dikoreksi.';
  const link = coachLink(period, appUrl);
  const next = link || '\nBuka menu Absensi & Slip Gaji di LMS.';
  return `${heading} - ${monthLabel(period)}\nHalo ${clean(name)}, cek rekap mengajarmu di LMS.${next}\n\n${correction}`;
}

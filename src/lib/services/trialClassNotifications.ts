import { normalizeIndonesianPhone } from '@/lib/phoneNumbers';

const DEFAULT_ADMIN_GROUP_JID = '120363299465478999@g.us';
const FREE_TRIAL_ADMIN_URL = 'https://lms.clev.io/admin/free-trials';
const COACH_DASHBOARD_URL = 'https://lms.clev.io/coach/dashboard';

export type TrialClassNotificationInput = {
  id: string;
  studentName: string;
  studentGrade: string;
  schoolName: string;
  parentName: string;
  phone: string;
  email: string;
  trialMode: 'ONLINE' | 'OFFLINE';
  notes?: string | null;
  createdAt: string;
};

type DeliveryResult = {
  success: boolean;
  error?: string;
  skipped?: boolean;
};

export type TrialCoachAssignmentNotificationInput = {
  coachId: string;
  coachName: string;
  coachPhone?: string | null;
  studentName: string;
  studentGrade: string;
  schoolName: string;
  trialMode: 'ONLINE' | 'OFFLINE';
  notes?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  meetUrl?: string | null;
};

export type TrialParentReportNotificationInput = {
  parentName: string;
  parentPhone: string;
  studentName: string;
  recommendedProgram: string;
  reportUrl: string;
  templateContent?: string | null;
  discountLabel?: string | null;
  discountAmount?: number;
  planDiscountPercent?: number;
};

export type TrialConversionNotificationInput = {
  assessmentId: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  recommendedLevel: string;
  invoiceNumber: string;
  totalAmount: number;
};

export function buildTrialClassAdminMessage(input: TrialClassNotificationInput) {
  const isOffline = input.trialMode === 'OFFLINE';

  return [
    '*Lead Free Trial Baru*',
    '',
    `*Anak:* ${input.studentName}`,
    `*Kelas:* ${input.studentGrade}`,
    `*Sekolah:* ${input.schoolName}`,
    `*Orang tua:* ${input.parentName}`,
    `*WA:* ${input.phone}`,
    `*Email:* ${input.email}`,
    `*Jenis trial:* ${isOffline ? 'Offline' : 'Online'}`,
    isOffline ? null : `*Preferensi jadwal:* ${input.notes?.trim() || 'Belum dicantumkan'}`,
    isOffline && input.notes?.trim() ? `*Catatan:* ${input.notes.trim()}` : null,
    `*Masuk:* ${formatSubmittedAt(input.createdAt)}`,
    '',
    `*Dashboard:* ${FREE_TRIAL_ADMIN_URL}`,
  ].filter((line): line is string => line !== null).join('\n');
}

export function buildTrialClassParentMessage(input: TrialClassNotificationInput) {
  const isOffline = input.trialMode === 'OFFLINE';

  return [
    `Halo Ayah/Bunda ${input.parentName},`,
    '',
    `Terima kasih sudah mendaftarkan ${input.studentName} untuk *Free Trial Class Clevio*.`,
    '',
    'Data pendaftaran sudah kami terima. Mohon menunggu, tim Clevio akan menghubungi Ayah/Bunda untuk tindak lanjut trial class.',
    '',
    `*Kelas:* ${input.studentGrade}`,
    `*Sekolah:* ${input.schoolName}`,
    `*Jenis trial:* ${isOffline ? 'Offline' : 'Online'}`,
    '',
    'Mohon pastikan peserta menyiapkan laptop dan koneksi internet yang stabil saat mengikuti trial class.',
    '',
    'Terima kasih.',
    '*Clevio Coder Camp*',
  ].filter((line): line is string => line !== null).join('\n');
}

export async function sendTrialClassNotifications(input: TrialClassNotificationInput) {
  const adminGroupJid = process.env.TRIAL_CLASS_ADMIN_WA_GROUP_JID || DEFAULT_ADMIN_GROUP_JID;

  const [adminGroup, parent] = await Promise.all([
    deliverMessage('admin group', adminGroupJid, buildTrialClassAdminMessage(input)),
    deliverMessage('parent', input.phone, buildTrialClassParentMessage(input)),
  ]);

  return { adminGroup, parent };
}

export function buildTrialCoachAssignmentWhatsAppMessage(input: TrialCoachAssignmentNotificationInput) {
  const isOnline = input.trialMode === 'ONLINE';

  return [
    '*Assignment Trial Class Baru*',
    '',
    `Halo Coach ${input.coachName},`,
    'Anda mendapat assignment trial class baru dengan detail berikut:',
    '',
    `*Peserta:* ${input.studentName}`,
    `*Kelas:* ${input.studentGrade}`,
    `*Sekolah:* ${input.schoolName}`,
    `*Jenis trial:* ${isOnline ? 'Online' : 'Offline'}`,
    `*Jadwal:* ${formatScheduledAt(input.scheduledAt)}`,
    `*Durasi:* ${input.durationMinutes} menit`,
    input.notes?.trim() ? `*Catatan:* ${input.notes.trim()}` : null,
    isOnline && input.meetUrl ? `*Google Meet:* ${input.meetUrl}` : null,
    '',
    `*Dashboard Coach:* ${COACH_DASHBOARD_URL}`,
    '',
    'Mohon persiapkan trial class sesuai jadwal. Terima kasih.',
  ].filter((line): line is string => line !== null).join('\n');
}

export function buildTrialCoachAssignmentWebsiteMessage(input: TrialCoachAssignmentNotificationInput) {
  const isOnline = input.trialMode === 'ONLINE';
  const safeMeetUrl = getSafeHttpUrl(input.meetUrl);
  const details = [
    ['Peserta', input.studentName],
    ['Kelas', input.studentGrade],
    ['Sekolah', input.schoolName],
    ['Jenis trial', isOnline ? 'Online' : 'Offline'],
    ['Jadwal', formatScheduledAt(input.scheduledAt)],
    ['Durasi', `${input.durationMinutes} menit`],
    input.notes?.trim() ? ['Catatan', input.notes.trim()] : null,
  ].filter((item): item is string[] => item !== null);

  return [
    `<p>Halo Coach ${escapeHtml(input.coachName)},</p>`,
    '<p>Anda mendapat assignment trial class baru.</p>',
    '<ul>',
    ...details.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`),
    '</ul>',
    isOnline && safeMeetUrl
      ? `<p><a href="${escapeHtml(safeMeetUrl)}" target="_blank" rel="noopener noreferrer"><strong>Masuk Google Meet</strong></a></p>`
      : null,
    `<p>Detail assignment juga tersedia di <a href="${COACH_DASHBOARD_URL}"><strong>Dashboard Coach</strong></a>.</p>`,
  ].filter((line): line is string => line !== null).join('\n');
}

export async function createTrialCoachAssignmentWebsiteNotification(
  input: TrialCoachAssignmentNotificationInput,
): Promise<DeliveryResult> {
  try {
    const { createNotification } = await import('@/lib/dao/notificationsDao');
    await createNotification(
      input.coachId,
      'Assignment Trial Class Baru',
      buildTrialCoachAssignmentWebsiteMessage(input),
      'SYSTEM',
    );
    return { success: true };
  } catch (error) {
    const messageError = error instanceof Error ? error.message : String(error);
    console.error('[FreeTrial] Website notification to assigned coach failed:', messageError);
    return { success: false, error: messageError };
  }
}

export async function sendTrialCoachAssignmentWhatsAppNotification(
  input: TrialCoachAssignmentNotificationInput,
): Promise<DeliveryResult> {
  if (!input.coachPhone?.trim()) {
    return { success: false, skipped: true, error: 'Coach phone is not set' };
  }

  return deliverMessage(
    'assigned coach',
    normalizeIndonesianPhone(input.coachPhone),
    buildTrialCoachAssignmentWhatsAppMessage(input),
  );
}

export function buildTrialParentReportWhatsAppMessage(input: TrialParentReportNotificationInput) {
  const registrationCta = buildTrialRegistrationCta(input);

  return [
    `Halo Ayah/Bunda ${input.parentName},`,
    '',
    `Laporan hasil *Free Trial Class* ${input.studentName} sudah tersedia.`,
    '',
    `Coach melihat ${input.studentName} cocok untuk melanjutkan ke program *${input.recommendedProgram}*.`,
    '',
    'Silakan buka report trial berikut untuk melihat rangkuman dan rekomendasi dari Coach:',
    input.reportUrl,
    '',
    registrationCta,
    '',
    'Terima kasih.',
    '*Clevio Coder Camp*',
  ].join('\n');
}

function formatTrialCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getTrialDiscountOffer(input: TrialParentReportNotificationInput) {
  const offers: string[] = [];
  const planDiscountPercent = Math.max(0, Number(input.planDiscountPercent) || 0);
  const discountAmount = Math.max(0, Math.round(Number(input.discountAmount) || 0));

  if (planDiscountPercent > 0) {
    offers.push(`diskon paket ${planDiscountPercent}%`);
  }
  if (discountAmount > 0) {
    offers.push(input.discountLabel?.trim()
      ? `${input.discountLabel.trim()} (${formatTrialCurrency(discountAmount)})`
      : `potongan ${formatTrialCurrency(discountAmount)}`);
  }

  return offers.join(' dan ');
}

function buildTrialRegistrationCta(input: TrialParentReportNotificationInput) {
  const offer = getTrialDiscountOffer(input);
  if (offer) {
    return `Yuk lanjut daftar sekarang ke program *${input.recommendedProgram}* melalui tombol pendaftaran di report. Saat ini tersedia ${offer}, selama program promo masih berlaku.`;
  }

  return `Jika Ayah/Bunda ingin melanjutkan, yuk daftar sekarang ke program *${input.recommendedProgram}* melalui tombol pendaftaran di report.`;
}

export async function sendTrialParentReportWhatsAppNotification(
  input: TrialParentReportNotificationInput,
): Promise<DeliveryResult> {
  const message = resolveTrialParentReportWhatsAppMessage(input);
  return deliverMessage(
    'trial report parent',
    input.parentPhone,
    message,
  );
}

export function buildTrialConversionAdminMessage(input: TrialConversionNotificationInput) {
  return [
    '*Trial berhasil daftar setelah pembayaran*',
    '',
    `*Anak:* ${input.studentName}`,
    `*Orang tua:* ${input.parentName}`,
    `*WA orang tua:* ${input.parentPhone}`,
    `*Level rekomendasi:* ${input.recommendedLevel}`,
    `*Invoice:* ${input.invoiceNumber}`,
    `*Total dibayar:* ${formatTrialCurrency(input.totalAmount)}`,
    '',
    '*Catatan:* Akun LMS belum dibuat otomatis.',
    '*Tindak lanjut Admin:* Buat akun LMS secara manual, lalu assign coder ke kelas Weekly yang sesuai dari dashboard Admin.',
    '',
    '*Sumber:* Trial Class',
  ].filter((line): line is string => line !== null).join('\n');
}

export async function sendTrialConversionAdminWhatsAppNotification(
  input: TrialConversionNotificationInput,
): Promise<DeliveryResult> {
  const adminGroupJid = process.env.TRIAL_CLASS_ADMIN_WA_GROUP_JID || DEFAULT_ADMIN_GROUP_JID;
  return deliverMessage(
    'trial conversion admin group',
    adminGroupJid,
    buildTrialConversionAdminMessage(input),
  );
}

function resolveTrialParentReportWhatsAppMessage(input: TrialParentReportNotificationInput) {
  if (input.templateContent) {
    let message = input.templateContent
      .replace(/{parent_name}/g, input.parentName)
      .replace(/{nama_siswa}/g, input.studentName)
      .replace(/{nama_kelas}/g, 'Free Trial Class')
      .replace(/{periode}/g, 'Free Trial Class')
      .replace(/{jenis_laporan}/g, 'Laporan hasil Free Trial Class')
      .replace(/{rekomendasi_program}/g, `Coach merekomendasikan program *${input.recommendedProgram}*.`)
      .replace(/{info_diskon}/g, getTrialDiscountOffer(input))
      .replace(/{ajakan_daftar}/g, buildTrialRegistrationCta(input))
      .replace(/{link_raport}/g, input.reportUrl);

    if (!message.includes('{ajakan_daftar}') && !message.includes(buildTrialRegistrationCta(input))) {
      message += `\n\n${buildTrialRegistrationCta(input)}`;
    }
    if (!message.includes(input.reportUrl)) {
      message += `\n\nLink report trial: ${input.reportUrl}`;
    }
    return message;
  }

  return buildTrialParentReportWhatsAppMessage(input);
}

async function deliverMessage(label: string, target: string, message: string): Promise<DeliveryResult> {
  try {
    const { sendWhatsAppMessage } = await import('@/lib/services/whatsappClient');
    const result = await sendWhatsAppMessage(target, message);
    if (!result.success) {
      console.error(`[FreeTrial] WhatsApp notification to ${label} failed:`, result.error);
    }
    return result;
  } catch (error) {
    const messageError = error instanceof Error ? error.message : String(error);
    console.error(`[FreeTrial] WhatsApp notification to ${label} failed:`, messageError);
    return { success: false, error: messageError };
  }
}

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}

function formatScheduledAt(value: string) {
  const date = new Date(value);
  const dateText = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
  const timeText = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date);

  return `${dateText}, pukul ${timeText} WIB`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getSafeHttpUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

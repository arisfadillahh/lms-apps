import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getServerAuthSession, getSessionOrThrow } from '@/lib/auth';
import { normalizeClassMeetingUrl } from '@/lib/classMeetingUrl';
import { classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateClassDeliverySchema = z.object({
  deliveryMode: z.enum(['ONLINE', 'OFFLINE']),
  zoomLink: z.string().trim().max(2048).optional().default(''),
  locationName: z.string().trim().max(160).optional().default(''),
  locationAddress: z.string().trim().max(500).optional().default(''),
  locationMapsUrl: z.string().trim().url('Link Google Maps tidak valid').max(2048).optional().or(z.literal('')).default(''),
  parentWhatsappEnabled: z.boolean().default(false),
  parentWhatsappClassReminderEnabled: z.boolean().default(false),
  parentWhatsappAbsenceEnabled: z.boolean().default(false),
  parentWhatsappMakeupEnabled: z.boolean().default(false),
  parentWhatsappReportEnabled: z.boolean().default(false),
  parentWhatsappEventEnabled: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.deliveryMode === 'ONLINE' && !value.zoomLink) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['zoomLink'], message: 'Link kelas wajib diisi untuk kelas Online' });
  }
  if (value.deliveryMode === 'OFFLINE') {
    if (!value.locationName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['locationName'], message: 'Nama tempat wajib diisi' });
    if (!value.locationAddress) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['locationAddress'], message: 'Alamat wajib diisi' });
    if (!value.locationMapsUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['locationMapsUrl'], message: 'Link Google Maps wajib diisi' });
  }
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const classId = (await context.params).id;
  const parsed = updateClassDeliverySchema.safeParse(await request.json().catch(() => null));
  if (!classId || !parsed.success) {
    const firstError = parsed.success ? null : parsed.error.issues[0]?.message;
    return NextResponse.json({ error: firstError || 'Pengaturan kelas tidak valid' }, { status: 400 });
  }

  const zoomLink = parsed.data.deliveryMode === 'ONLINE'
    ? normalizeClassMeetingUrl(parsed.data.zoomLink)
    : '';
  if (parsed.data.deliveryMode === 'ONLINE' && !zoomLink) {
    return NextResponse.json(
      { error: 'Gunakan link Google Meet, Zoom, atau ruang kelas online yang valid. Link placeholder Clevio tidak dapat dipakai.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: klass, error: classError } = await supabase
    .from('classes')
    .select('id, type')
    .eq('id', classId)
    .maybeSingle();
  if (classError) return NextResponse.json({ error: classError.message }, { status: 500 });
  if (!klass) return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });

  const { error: updateClassError } = await supabase
    .from('classes')
    .update({
      delivery_mode: parsed.data.deliveryMode,
      zoom_link: zoomLink ?? '',
      location_name: parsed.data.deliveryMode === 'OFFLINE' ? parsed.data.locationName : null,
      location_address: parsed.data.deliveryMode === 'OFFLINE' ? parsed.data.locationAddress : null,
      location_maps_url: parsed.data.deliveryMode === 'OFFLINE' ? parsed.data.locationMapsUrl : null,
      parent_whatsapp_enabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappEnabled,
      parent_whatsapp_class_reminder_enabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappClassReminderEnabled,
      parent_whatsapp_absence_enabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappAbsenceEnabled,
      parent_whatsapp_makeup_enabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappMakeupEnabled,
      parent_whatsapp_report_enabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappReportEnabled,
      parent_whatsapp_event_enabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappEventEnabled,
    })
    .eq('id', classId);
  if (updateClassError) return NextResponse.json({ error: updateClassError.message }, { status: 500 });

  const activeWindowStart = new Date(Date.now() - 120 * 60 * 1000).toISOString();
  const { data: updatedSessions, error: updateSessionsError } = await supabase
    .from('sessions')
    .update({ zoom_link_snapshot: zoomLink ?? '' })
    .eq('class_id', classId)
    .eq('status', 'SCHEDULED')
    .gt('date_time', activeWindowStart)
    .select('id');
  if (updateSessionsError) {
    return NextResponse.json(
      { error: 'Pengaturan kelas tersimpan, tetapi sinkronisasi sesi mendatang gagal. Silakan coba simpan lagi.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deliveryMode: parsed.data.deliveryMode,
    zoomLink: zoomLink ?? '',
    parentWhatsappEnabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappEnabled,
    parentWhatsappClassReminderEnabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappClassReminderEnabled,
    parentWhatsappAbsenceEnabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappAbsenceEnabled,
    parentWhatsappMakeupEnabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappMakeupEnabled,
    parentWhatsappReportEnabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappReportEnabled,
    parentWhatsappEventEnabled: klass.type === 'EKSKUL' && parsed.data.parentWhatsappEventEnabled,
    updatedFutureSessions: updatedSessions?.length ?? 0,
  });
}

async function classClosure(request: NextRequest, context: RouteContext, apply: boolean) {
  const session = await getServerAuthSession();
  if (!session) return NextResponse.json({ error: 'Silakan masuk kembali.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Akses admin diperlukan.' }, { status: 403 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID kelas tidak valid.' }, { status: 400 });
  }
  let confirmationName: string | undefined;
  if (apply) {
    const payload = z.object({ confirmationName: z.string().trim().min(1) }).safeParse(await request.json().catch(() => null));
    if (!payload.success) return NextResponse.json({ error: 'Konfirmasi nama kelas diperlukan.' }, { status: 400 });
    confirmationName = payload.data.confirmationName;
  }
  try {
    const closure = await classesDao.closeAndArchiveClass(id, session.user.id, confirmationName);
    return NextResponse.json(closure, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === 'PT403' || dbError.code === 'PT404' || dbError.code === 'PT409') {
      return NextResponse.json({ error: dbError.message }, { status: Number(dbError.code.slice(2)) });
    }
    console.error('Failed to close class', { classId: id, error });
    return NextResponse.json({ error: 'Penutupan kelas belum bisa dikonfirmasi. Coba lagi.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return classClosure(request, context, false);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return classClosure(request, context, true);
}

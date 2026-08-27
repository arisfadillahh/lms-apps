import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const params = await context.params;
  const classId = params.id;

  if (!classId) {
    return NextResponse.json({ error: 'Invalid class id' }, { status: 400 });
  }

  try {
    const payload = await request.json().catch(() => null) as { confirmationName?: unknown } | null;
    const confirmationName = typeof payload?.confirmationName === 'string'
      ? payload.confirmationName.trim()
      : '';
    const klass = await classesDao.getClassById(classId);

    if (!klass) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan' }, { status: 404 });
    }

    if (!confirmationName || confirmationName !== klass.name.trim()) {
      return NextResponse.json(
        { error: 'Nama kelas tidak cocok. Penghapusan dibatalkan.' },
        { status: 400 },
      );
    }

    await classesDao.deleteClass(classId);
  } catch (error) {
    if (error instanceof Error && error.name === 'ClassDeletionBlockedError') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Failed to delete class', error);
    return NextResponse.json(
      { error: 'Kelas gagal dihapus. Tidak ada data lain yang sengaja dihapus.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

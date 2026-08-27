import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { notificationsDao, reportsDao } from '@/lib/dao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertRole } from '@/lib/roles';
import { sendReportNotification } from '@/lib/services/whatsappClient';
import { getAppBaseUrl } from '@/lib/env';
import { isRegularReportWindowActive } from '@/lib/services/reportWindows';
import { shouldSendParentWhatsappForClass } from '@/lib/classReminderEligibility';
import { publishReportWithOptionalWhatsapp } from '@/lib/reportPublication';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const reportId = params.id;
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const supabase = getSupabaseAdmin();

  // 1. Fetch the unified block_report
  const { data: report, error } = await supabase
    .from('block_reports')
    .select(`
      *,
      class:classes(id, name, type, parent_whatsapp_enabled, parent_whatsapp_report_enabled),
      block:blocks(id, name),
      coder:users!block_reports_coder_id_fkey(id, full_name, parent_contact_phone)
    `)
    .eq('id', reportId)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: 'Report tidak ditemukan' }, { status: 404 });
  }

  if (report.sent_via_whatsapp) {
    return NextResponse.json({ error: 'Report sudah pernah dikirim via WhatsApp' }, { status: 400 });
  }

  if (report.status === 'PUBLISHED') {
     return NextResponse.json({ error: 'Report sudah pernah di-publish oleh Admin' }, { status: 400 });
  }

  if (report.status !== 'SUBMITTED') {
     return NextResponse.json({ error: 'Report belum dikirim oleh Coach' }, { status: 400 });
  }

  const coder = Array.isArray(report.coder) ? report.coder[0] : report.coder;
  const klass = Array.isArray(report.class) ? report.class[0] : report.class;
  const block = Array.isArray(report.block) ? report.block[0] : report.block;

  if (klass && (klass as any).type !== 'EKSKUL') {
    const { data: classBlock, error: classBlockError } = await supabase
      .from('class_blocks')
      .select('pitching_day_date')
      .eq('class_id', report.class_id)
      .eq('block_id', report.block_id)
      .maybeSingle();

    if (classBlockError) {
      return NextResponse.json({ error: `Gagal memvalidasi jadwal pitching: ${classBlockError.message}` }, { status: 500 });
    }

    if (!isRegularReportWindowActive(classBlock)) {
      return NextResponse.json(
        { error: 'Rapor ini di luar jadwal pitching aktif, jadi tidak bisa dikirim ke orang tua.' },
        { status: 400 },
      );
    }
  }

  const parentPhone = coder?.parent_contact_phone;

  // Generate the new web view URL instead of a PDF URL
  const reportUrl = `${getAppBaseUrl()}/report/${reportId}`;
  const delivery = await publishReportWithOptionalWhatsapp({
    shouldSendWhatsapp: shouldSendParentWhatsappForClass(klass as any, 'REPORT'),
    hasParentPhone: Boolean(parentPhone),
    now: () => new Date().toISOString(),
    publish: async ({ sent_via_whatsapp, sent_at }) => {
      await reportsDao.updateBlockReport(reportId, {
        status: 'PUBLISHED',
        sent_via_whatsapp,
        sent_at,
      });
    },
    notifyCoder: async () => {
      try {
        await notificationsDao.createNotification(
          coder.id,
          'Rapor terbaru sudah tersedia',
          `Rapor ${block?.name || klass.name} sudah dipublikasikan. Buka menu Rapor & Portofolio untuk melihat hasilnya.`,
          'REPORT_PUBLISHED',
          {
            actionUrl: '/coder/reports',
            category: 'REPORT',
            priority: 'NORMAL',
            dedupeKey: `report-published-${reportId}`,
            push: true,
            pushTag: `report-${reportId}`,
          },
        );
      } catch (notificationError) {
        console.error('[ReportPublish] Failed to notify Coder', notificationError);
      }
    },
    createWhatsappLog: () => reportsDao.logWhatsappEvent({
      category: 'REPORT_SEND',
      payload: {
        reportId,
        coderId: coder.id,
        classId: klass.id,
        parentPhone,
        reportUrl,
      },
    }),
    sendWhatsapp: () => sendReportNotification({
      coderFullName: coder.full_name,
      className: klass.name,
      period: block?.name || undefined,
      reportUrl,
      parentPhone: parentPhone!,
    }),
    updateWhatsappLog: (id, status, response) => reportsDao.updateWhatsappLogStatus(id, status, response as any),
  });

  return NextResponse.json({
    status: 'PUBLISHED',
    whatsapp: {
      status: delivery.whatsappStatus,
      warning: delivery.warning,
    },
    report: {
      id: reportId,
      reportUrl,
      sentToParentAt: delivery.sentAt,
    },
  });
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { reportsDao, usersDao } from '@/lib/dao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertRole } from '@/lib/roles';
import { sendReportNotification } from '@/lib/services/whatsappClient';
import { getAppBaseUrl } from '@/lib/env';
import { isRegularReportWindowActive } from '@/lib/services/reportWindows';

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
      class:classes(id, name, type),
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

  if (!parentPhone) {
    return NextResponse.json({ error: 'Nomor WhatsApp orang tua belum tersedia untuk coder ini' }, { status: 400 });
  }

  // Generate the new web view URL instead of a PDF URL
  const reportUrl = `${getAppBaseUrl()}/report/${reportId}`;

  // Log to WA events table (using block report fields instead of old rubric submission ids)
  const logEntry = await reportsDao.logWhatsappEvent({
    category: 'REPORT_SEND',
    payload: {
      reportId,
      coderId: coder.id,
      classId: klass.id,
      parentPhone,
      reportUrl
    },
  });

  try {
    const response = await sendReportNotification({
      coderFullName: coder.full_name,
      className: klass.name,
      period: block?.name || undefined,
      reportUrl,
      parentPhone,
    });

    const sentAt = new Date().toISOString();
    
    // Update the block_reports sent status to PUBLISHED
    await reportsDao.updateBlockReport(reportId, {
       status: 'PUBLISHED',
       sent_via_whatsapp: true,
       sent_at: sentAt
    });
    
    await reportsDao.updateWhatsappLogStatus(logEntry.id, 'SENT', response as any);

    return NextResponse.json({
      status: 'PUBLISHED',
      report: {
        id: reportId,
        reportUrl,
        sentToParentAt: sentAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengirim pesan WhatsApp';
    await reportsDao.updateWhatsappLogStatus(logEntry.id, 'FAILED', { message });
    console.error('Failed to send WhatsApp report', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

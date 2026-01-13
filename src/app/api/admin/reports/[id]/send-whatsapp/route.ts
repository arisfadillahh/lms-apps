import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { reportsDao, rubricsDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { sendReport } from '@/lib/whatsapp/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const reportId = params.id;
  const report = await reportsDao.getReportById(reportId);
  if (!report) {
    return NextResponse.json({ error: 'Report tidak ditemukan' }, { status: 404 });
  }

  if (report.sent_via_whatsapp) {
    return NextResponse.json({ error: 'Report sudah pernah dikirim via WhatsApp' }, { status: 400 });
  }

  const detail = await rubricsDao.getRubricSubmissionDetail(report.rubric_submission_id);
  if (!detail) {
    return NextResponse.json({ error: 'Rubric submission tidak ditemukan' }, { status: 404 });
  }

  const coderUser = await usersDao.getUserById(detail.coder.id);
  const parentPhone = coderUser?.parent_contact_phone;
  if (!parentPhone) {
    return NextResponse.json({ error: 'Nomor WhatsApp orang tua belum tersedia untuk coder ini' }, { status: 400 });
  }

  const logEntry = await reportsDao.logWhatsappEvent({
    category: 'REPORT_SEND',
    payload: {
      reportId,
      rubricSubmissionId: report.rubric_submission_id,
      coderId: detail.coder.id,
      classId: detail.class.id,
      parentPhone,
    },
  });

  try {
    const response = await sendReport({
      coderFullName: detail.coder.full_name,
      className: detail.class.name,
      pdfUrl: report.pdf_url,
      parentPhone,
    });

    const sentAt = new Date().toISOString();
    await reportsDao.markReportSent(report.id, sentAt);
    await reportsDao.updateWhatsappLogStatus(logEntry.id, 'SENT', response as any);

    return NextResponse.json({
      status: 'SENT',
      report: {
        id: report.id,
        pdfUrl: report.pdf_url,
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

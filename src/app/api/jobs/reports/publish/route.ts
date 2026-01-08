import { NextResponse } from 'next/server';

import { reportsDao, rubricsDao, usersDao } from '@/lib/dao';
import { verifyCronRequest } from '@/lib/cron';
import { sendReport } from '@/lib/whatsapp/client';

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pendingReports = await reportsDao.listUnsentReports();
  const results: Array<{ reportId: string; status: string }> = [];

  for (const report of pendingReports) {
    const detail = await rubricsDao.getRubricSubmissionDetail(report.rubric_submission_id);
    if (!detail) {
      continue;
    }

    const coder = await usersDao.getUserById(detail.coder.id);
    if (!coder?.parent_contact_phone) {
      continue;
    }

    const logEntry = await reportsDao.logWhatsappEvent({
      category: 'REPORT_SEND',
      payload: {
        reportId: report.id,
        rubricSubmissionId: report.rubric_submission_id,
        coderId: detail.coder.id,
      },
    });

    try {
      const response = await sendReport({
        coderFullName: detail.coder.full_name,
        className: detail.class.name,
        pdfUrl: report.pdf_url,
        parentPhone: coder.parent_contact_phone,
      });
      await reportsDao.markReportSent(report.id, new Date().toISOString());
      await reportsDao.updateWhatsappLogStatus(logEntry.id, 'SENT', response as any);
      results.push({ reportId: report.id, status: 'SENT' });
    } catch (error: any) {
      await reportsDao.updateWhatsappLogStatus(logEntry.id, 'FAILED', { message: error.message ?? 'Failed' });
      results.push({ reportId: report.id, status: 'FAILED' });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

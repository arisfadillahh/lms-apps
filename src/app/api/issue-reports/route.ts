import { after, NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { createAdminNotifications } from '@/lib/dao/notificationsDao';
import {
  buildIssueReportWhatsAppMessage,
  formatIssueReportReference,
  getIssueScreenshotExtension,
  ISSUE_REPORT_WHATSAPP_NUMBER,
  ISSUE_SCREENSHOT_MAX_BYTES,
  issueReportSchema,
} from '@/lib/issueReports';
import { sendWhatsAppImage, sendWhatsAppMessage } from '@/lib/services/whatsappClient';
import { uploadIssueScreenshot } from '@/lib/storage';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { consumeRateLimit } from '@/lib/rateLimit';
import { detectAvatarImageType } from '@/lib/services/avatarUploadSecurity';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COACH' && session.user.role !== 'CODER') {
      return NextResponse.json({ error: 'Role ini tidak dapat mengirim report' }, { status: 403 });
    }
    if (!await consumeRateLimit({ request, scope: 'issue-report', actorId: session.user.id, maxRequests: 10, windowSeconds: 60 * 60 })) {
      return NextResponse.json({ error: 'Terlalu banyak report. Silakan coba lagi nanti.' }, { status: 429 });
    }

    const formData = await request.formData();
    const parsed = issueReportSchema.safeParse({
      title: formData.get('title'),
      description: formData.get('description'),
      pageUrl: formData.get('pageUrl') || '',
      viewportWidth: formData.get('viewportWidth') || undefined,
      viewportHeight: formData.get('viewportHeight') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data report tidak valid' }, { status: 400 });
    }

    const screenshot = formData.get('screenshot');
    let screenshotBuffer: Buffer | null = null;
    let screenshotContentType: string | null = null;
    let screenshotExtension: string | null = null;

    if (screenshot instanceof File && screenshot.size > 0) {
      screenshotExtension = getIssueScreenshotExtension(screenshot.type);
      if (!screenshotExtension) {
        return NextResponse.json({ error: 'Screenshot harus berupa PNG, JPG, atau WebP' }, { status: 400 });
      }
      if (screenshot.size > ISSUE_SCREENSHOT_MAX_BYTES) {
        return NextResponse.json({ error: 'Ukuran screenshot maksimal 5 MB' }, { status: 400 });
      }
      screenshotBuffer = Buffer.from(await screenshot.arrayBuffer());
      const detectedType = detectAvatarImageType(screenshot.type, screenshotBuffer);
      if (!detectedType || detectedType.contentType === 'image/gif') {
        return NextResponse.json({ error: 'Isi screenshot tidak cocok dengan format PNG, JPG, atau WebP' }, { status: 400 });
      }
      screenshotContentType = detectedType.contentType;
      screenshotExtension = detectedType.extension.replace('.', '');
    }

    const supabase = getSupabaseAdmin();
    const createdAt = new Date().toISOString();
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;
    const { data: report, error: insertError } = await supabase
      .from('issue_reports')
      .insert({
        reporter_id: session.user.id,
        reporter_role: session.user.role,
        reporter_name: session.user.fullName || session.user.username,
        title: parsed.data.title,
        description: parsed.data.description,
        page_url: parsed.data.pageUrl || null,
        user_agent: userAgent,
        viewport: {
          width: parsed.data.viewportWidth ?? null,
          height: parsed.data.viewportHeight ?? null,
        },
        created_at: createdAt,
      })
      .select('*')
      .single();

    if (insertError || !report) {
      console.error('[IssueReport] Failed to insert report', insertError);
      return NextResponse.json({ error: 'Report belum berhasil disimpan. Silakan coba lagi.' }, { status: 500 });
    }

    let screenshotUrl: string | null = null;
    let screenshotStoragePath: string | null = null;
    let screenshotUploadWarning: string | null = null;
    if (screenshotBuffer && screenshotContentType && screenshotExtension) {
      try {
        screenshotStoragePath = `issue-reports/${createdAt.slice(0, 7)}/${report.id}.${screenshotExtension}`;
        await uploadIssueScreenshot(screenshotStoragePath, screenshotBuffer, screenshotContentType);
        await supabase.from('issue_reports').update({
          screenshot_url: null,
          screenshot_storage_path: screenshotStoragePath,
        }).eq('id', report.id);
      } catch (error) {
        console.error('[IssueReport] Screenshot upload failed', error);
        screenshotStoragePath = null;
        screenshotUploadWarning = 'Report tersimpan dan gambar tetap dikirim ke WhatsApp, tetapi arsip screenshot belum berhasil disimpan.';
      }
    }

    // Keep the admin notification inbox useful even when WhatsApp is unavailable.
    // This is intentionally best-effort: a notification failure must not reject a saved report.
    try {
      await createAdminNotifications({
        type: 'ISSUE_REPORT',
        title: 'Report masalah baru',
        message: `${report.reporter_name} mengirim report: ${report.title}. Buka menu Laporan Masalah untuk melihat detailnya.`,
        pushUrl: '/admin/issue-reports',
        pushTag: `issue-report-${report.id}`,
      });
    } catch (notificationError) {
      console.error('[IssueReport] Failed to create admin notifications', notificationError);
    }

    const caption = buildIssueReportWhatsAppMessage({
      id: report.id,
      reporterName: report.reporter_name,
      reporterRole: report.reporter_role,
      title: report.title,
      description: report.description,
      pageUrl: report.page_url,
      createdAt: report.created_at,
      hasScreenshot: Boolean(screenshotBuffer),
    });

    after(async () => {
      const result = screenshotBuffer && screenshotContentType
        ? await sendWhatsAppImage({
            phoneNumber: ISSUE_REPORT_WHATSAPP_NUMBER,
            image: screenshotBuffer,
            mimeType: screenshotContentType,
            caption,
          })
        : await sendWhatsAppMessage(ISSUE_REPORT_WHATSAPP_NUMBER, caption);

      await supabase.from('issue_reports').update({
        whatsapp_status: result.success ? 'SENT' : 'FAILED',
        whatsapp_error: result.error || null,
      }).eq('id', report.id);
    });

    return NextResponse.json({
      ok: true,
      reportId: report.id,
      reference: formatIssueReportReference(report.id),
      screenshotUrl,
      warning: screenshotUploadWarning,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized' || message === 'Inactive account') {
      return NextResponse.json({ error: 'Sesi login tidak valid' }, { status: 401 });
    }
    console.error('[IssueReport] Unexpected submit error', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengirim report' }, { status: 500 });
  }
}

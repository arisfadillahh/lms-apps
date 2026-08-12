import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { issueReportUpdateSchema } from '@/lib/issueReports';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');
    const { id } = await context.params;
    const parsed = issueReportUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data tidak valid' }, { status: 400 });
    }

    const isResolved = parsed.data.status === 'RESOLVED' || parsed.data.status === 'CLOSED';
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('issue_reports')
      .update({
        status: parsed.data.status,
        priority: parsed.data.priority,
        admin_notes: parsed.data.adminNotes || null,
        resolution_summary: parsed.data.resolutionSummary || null,
        resolved_by: isResolved ? session.user.id : null,
        resolved_at: isResolved ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[AdminIssueReports] Failed to update report', error);
      return NextResponse.json({ error: 'Perubahan belum berhasil disimpan' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Report tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ ok: true, report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized' || message === 'Inactive account') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('not permitted')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[AdminIssueReports] Unexpected update error', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui report' }, { status: 500 });
  }
}

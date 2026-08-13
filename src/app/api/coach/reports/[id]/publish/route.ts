import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { createAdminNotifications } from '@/lib/dao/notificationsDao';
import { reportsDao, classesDao } from '@/lib/dao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionOrThrow();
    if (!sessionUser || sessionUser.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const { descriptions } = body;

    if (!descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
      return NextResponse.json({ error: 'Descriptions array is required' }, { status: 400 });
    }
    
    // Validate empty texts
    const hasEmpty = descriptions.some(d => !d.description.trim());
    if (hasEmpty) {
       return NextResponse.json({ error: 'No description can be empty' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify ownership
    const { data: report } = await supabase
      .from('block_reports')
      .select('status, class:classes(id, coach_id)')
      .eq('id', id)
      .single();

    if (!report) {
       return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const klass = Array.isArray(report.class) ? report.class[0] : report.class;
    if (!klass) {
       return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    
    // Proper multi-coach check
    const coachClasses = await classesDao.listClassesForCoach(sessionUser.user.id);
    const isAuthorized = coachClasses.some(c => c.id === klass.id);
    
    if (!isAuthorized) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (report.status === 'SUBMITTED' || report.status === 'PUBLISHED') {
       return NextResponse.json({ error: 'Report is already submitted/published' }, { status: 400 });
    }

    // 1. Update the descriptions
    await reportsDao.upsertBlockReportDescriptions(
      descriptions.map((d: any) => ({
        reportId: id,
        criteriaId: d.criteriaId,
        score: d.score || 0,
        description: d.description.trim()
      }))
    );

    // 2. Change status to SUBMITTED
    await reportsDao.updateBlockReport(id, {
      status: 'SUBMITTED'
    });

    try {
      const className = coachClasses.find((coachClass) => coachClass.id === klass.id)?.name || 'kelas';
      await createAdminNotifications({
        type: 'REPORT_REVIEW',
        title: 'Rapor siap direview',
        message: `${sessionUser.user.fullName || sessionUser.user.username} mengirim rapor dari ${className} untuk direview dan dikirim.`,
        pushUrl: '/admin/reports',
        pushTag: `report-review-${id}`,
      });
    } catch (notificationError) {
      console.error('[CoachReport] Failed to notify admins', notificationError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error publishing report:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

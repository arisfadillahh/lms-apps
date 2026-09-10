import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { createAdminNotifications } from '@/lib/dao/notificationsDao';
import { reportsDao, classesDao } from '@/lib/dao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { isEnrollmentActiveForSession } from '@/lib/services/enrollmentEligibility';

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
      .select('status, class_id, block_id, coder_id, class:classes(id, coach_id, lifecycle_status)')
      .eq('id', id)
      .single();

    if (!report) {
       return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const klass = Array.isArray(report.class) ? report.class[0] : report.class;
    if (!klass) {
       return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const [
      { data: enrollmentRows, error: enrollmentError },
      { data: reflection, error: reflectionError },
      { data: reportBlock, error: reportBlockError },
    ] = await Promise.all([
      supabase
        .from('enrollments')
        .select('*')
        .eq('class_id', (report as any).class_id)
        .eq('coder_id', (report as any).coder_id),
      supabase
        .from('block_evaluations')
        .select('id')
        .eq('class_id', (report as any).class_id)
        .eq('block_id', (report as any).block_id)
        .eq('coder_id', (report as any).coder_id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('class_blocks')
        .select('pitching_day_date')
        .eq('class_id', (report as any).class_id)
        .eq('block_id', (report as any).block_id)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (enrollmentError || reflectionError || reportBlockError) {
      throw new Error(enrollmentError?.message || reflectionError?.message || reportBlockError?.message || 'Gagal memvalidasi rapor');
    }
    const eligibilityTime = reportBlock?.pitching_day_date
      ? reportBlock.pitching_day_date + 'T23:59:59+07:00'
      : new Date().toISOString();
    const eligibleEnrollment = (enrollmentRows ?? []).some((enrollment) =>
      isEnrollmentActiveForSession(enrollment, eligibilityTime),
    );
    if (!eligibleEnrollment) {
      return NextResponse.json({ error: 'Coder tidak terdaftar di kelas ini pada periode rapor' }, { status: 400 });
    }
    if (!reflection) {
      return NextResponse.json({ error: 'Refleksi evaluasi coder belum selesai' }, { status: 400 });
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
      status: 'SUBMITTED',
      coach_id_snapshot: sessionUser.user.id,
      coach_name_snapshot: sessionUser.user.fullName || sessionUser.user.username,
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

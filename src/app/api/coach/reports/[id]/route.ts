import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { classesDao } from '@/lib/dao';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionOrThrow();
    const coachSession = await assertRole(session, 'COACH');

    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get the report to find out the coder_id, class_id, and block_id
    const { data: report, error: fetchError } = await supabase
      .from('block_reports')
      .select('coder_id, class_id, block_id')
      .eq('id', id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const coachClasses = await classesDao.listClassesForCoach(coachSession.user.id);
    const substituteClasses = await classesDao.listClassesWhereCoachIsSubstitute(coachSession.user.id);
    const authorizedClassIds = new Set([...coachClasses, ...substituteClasses].map((klass) => klass.id));

    if (!authorizedClassIds.has(report.class_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. We need to find the session IDs for this class and block.
    // However, to make a lesson "Pending" again, we just need to delete the `lesson_evaluations` 
    // for this specific coder. 
    // We can find all lesson_evaluations for this coder_id on sessions belonging to this class.
    
    // First find all sessions for this class
    const { data: sessions } = await supabase
      .from('class_lessons')
      .select('session_id')
      .eq('class_id', report.class_id);
      
    const sessionIds = (sessions || []).map(s => s.session_id).filter(id => id !== null) as string[];
    
    // Delete lesson evaluations for this coder in these sessions
    if (sessionIds.length > 0) {
      const { error: evalDeleteError } = await supabase
        .from('lesson_evaluations')
        .delete()
        .eq('coder_id', report.coder_id)
        .in('session_id', sessionIds);
        
      if (evalDeleteError) {
        console.error('[Delete Report] Failed to delete lesson evaluations:', evalDeleteError);
        // We continue anyway to at least delete the report
      }
    }

    // 3. Delete the block report. (Cascade should handle block_report_descriptions)
    const { error: deleteError } = await supabase
      .from('block_reports')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Delete Report] Subapase error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Report and assigned evaluations deleted' });
  } catch (error: any) {
    console.error('[Delete Report] Unexpected error:', error);
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

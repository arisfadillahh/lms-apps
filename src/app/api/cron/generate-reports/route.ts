import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateDraftReportsTask, reconcileEkskulFinalDrafts } from '@/lib/services/aiReports';
import { verifyCronRequest } from '@/lib/cron';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const classId = new URL(request.url).searchParams.get('ekskulClassId');
    if (classId !== null && !z.string().uuid().safeParse(classId).success) {
      return NextResponse.json({ error: 'Invalid Ekskul class ID' }, { status: 400 });
    }
    const result = classId ? await reconcileEkskulFinalDrafts(classId) : await generateDraftReportsTask();
    
    return NextResponse.json({ 
      success: true, 
      processed: result.count,
      message: `Generated ${result.count} new draft reports.`
    });
  } catch (error) {
    console.error('Error generating AI reports via cron:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { generateDraftReportsTask } from '@/lib/services/aiReports';
import { verifyCronRequest } from '@/lib/cron';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await generateDraftReportsTask();
    
    return NextResponse.json({ 
      success: true, 
      processed: result.count,
      message: `Generated ${result.count} new draft reports.`
    });
  } catch (error: any) {
    console.error('Error generating AI reports via cron:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

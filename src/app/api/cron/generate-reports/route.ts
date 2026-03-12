import { NextResponse } from 'next/server';
import { generateDraftReportsTask } from '@/lib/services/aiReports';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  // Try mapping cron secret so it is protected
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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

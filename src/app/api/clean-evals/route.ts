import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: evals, error: evalError } = await supabase
      .from('lesson_evaluations')
      .select('coder_id');
      
    if (evalError) throw evalError;
    if (!evals || evals.length === 0) {
      return NextResponse.json({ message: 'Ga ada evaluation sama sekali.' });
    }
    
    const uniqueCoderIds = Array.from(new Set(evals.map(e => e.coder_id)));
    let deletedCount = 0;
    
    for (const coderId of uniqueCoderIds) {
      const { data: reports, error: reportError } = await supabase
        .from('block_reports')
        .select('id')
        .eq('coder_id', coderId);
        
      if (reportError) throw reportError;
      
      if (!reports || reports.length === 0) {
        const { error: delError } = await supabase
          .from('lesson_evaluations')
          .delete()
          .eq('coder_id', coderId);
          
        if (delError) console.error('Gagal hapus:', delError);
        else deletedCount++;
      }
    }
    
    return NextResponse.json({ success: true, message: `Beres! ${deletedCount} coder dibersihkan nilai yatim piatunya.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

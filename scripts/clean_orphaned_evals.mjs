import { createClient } from '@supabase/supabase-js';

// Pastikan copy URL & Key anon/service_role dari .env lu
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanOrphanedEvaluations() {
  console.log('Tarik semua coder yang punya lesson_evaluations...');
  
  // 1. Ambil semua evaluation
  const { data: evals, error: evalError } = await supabase
    .from('lesson_evaluations')
    .select('coder_id');
    
  if (evalError) throw evalError;
  if (!evals || evals.length === 0) {
    console.log('Ga ada evaluation sama sekali.');
    return;
  }
  
  // Dapatkan coder_id unik
  const uniqueCoderIds = Array.from(new Set(evals.map(e => e.coder_id)));
  console.log(`Ada ${uniqueCoderIds.length} coder yg punya nilai.`);

  // 2. Cek satu-satu apakah mereka punya report
  let deletedCount = 0;
  
  for (const coderId of uniqueCoderIds) {
    const { data: reports, error: reportError } = await supabase
      .from('block_reports')
      .select('id')
      .eq('coder_id', coderId);
      
    if (reportError) throw reportError;
    
    // Kalau coder ini GA PUNYA report sama sekali di block_reports
    // berarti semua nilai dia itu yatim piatu (karena reportnya udah diapus manual)
    if (!reports || reports.length === 0) {
      console.log(`🗑️ Hapus semua nilai untuk coder ${coderId} (Ga punya report)`);
      const { error: delError } = await supabase
        .from('lesson_evaluations')
        .delete()
        .eq('coder_id', coderId);
        
      if (delError) console.error('Gagal hapus:', delError);
      else deletedCount++;
    }
  }
  
  console.log(`Beres! ${deletedCount} coder dibersihkan nilai yatim piatunya.`);
}

cleanOrphanedEvaluations().catch(console.error);

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const classId = '23a83a47-b026-4ead-9d26-50ed8a56a5ef';
    const { data: blocks } = await supabaseAdmin.from('class_blocks').select('*').eq('class_id', classId);
    
    const sortedBlocksChronological = [...blocks].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    const now_exact = new Date();
    let currentOrUpcoming =
      sortedBlocksChronological.find((block) => new Date(block.start_date) <= now_exact && new Date(block.end_date) >= now_exact) ??
      sortedBlocksChronological.find((block) => new Date(block.start_date) > now_exact) ??
      sortedBlocksChronological.find((block) => block.status === 'CURRENT') ??
      sortedBlocksChronological.find((block) => block.status === 'UPCOMING');
      
    console.log("Selected block id:", currentOrUpcoming?.id);
    console.log("Selected block status:", currentOrUpcoming?.status);
    console.log("Selected block start:", currentOrUpcoming?.start_date);
    console.log("Selected block end:", currentOrUpcoming?.end_date);
    
    // Check lessons for this block
    const { data: classLessons } = await supabaseAdmin.from('class_lessons').select('*').eq('class_block_id', currentOrUpcoming?.id);
    console.log("Lessons in selected block:", classLessons?.length);
    console.log("Are lessons returned empty initially?", classLessons?.slice(0,2));
}

run();

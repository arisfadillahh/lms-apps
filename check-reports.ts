import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf8');
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY! // Use service key to bypass RLS
);

async function check() {
  const { data: blocks } = await supabase
    .from('blocks')
    .select('id, name, status, class_id')
    .in('status', ['ACTIVE', 'COMPLETED'])
    .order('end_date', { ascending: false })
    .limit(5);

  console.log('--- RECENT BLOCKS ---');
  console.log(blocks);

  if (blocks && blocks.length > 0) {
    const blockIds = blocks.map(b => b.id);
    
    // We need to find the sessions mapped to this block, but computeLessonSchedule is complex.
    // Let's just find if ANY lesson_evaluations exist at all.
    const { data: evaluations } = await supabase
      .from('lesson_evaluations')
      .select('session_id, coder_id, criteria_id, score')
      .limit(10);
      
    console.log('--- RECENT EVALUATIONS ---');
    console.log(evaluations);
  }
}

check();

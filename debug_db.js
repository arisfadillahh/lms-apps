const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://wfizooodvytlizdgxueh.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaXpvb29kdnl0bGl6ZGd4dWVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzg1ODUxOSwiZXhwIjoyMDY5NDM0NTE5fQ.yZI8jxJ5Ye6IC9R6CoSWOYjcCANiyAlTvufkjV9VP9I';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function check() {
  const id = '5061fbc7-2098-46ba-b7e9-152154bb6493';
  console.log('Checking ID:', id);

  const { data: b, error: be } = await supabase.from('block_reports').select('id, status').eq('id', id).maybeSingle();
  console.log('block_reports result:', b, be);

  // List users to verify DB context
  const { data: u, error: ue } = await supabase.from('users').select('full_name, role').limit(10);
  console.log('Recent 10 users:', u, ue);
}

check();

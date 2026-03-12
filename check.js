const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env', 'utf8');
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service key to bypass RLS
);

async function check() {
  const { data: report, error } = await supabase
    .from('block_reports')
    .select(`
      *,
      class:classes(id, name, coach_id),
      block:blocks(name, start_date, end_date),
      coder:users!block_reports_coder_id_fkey(full_name, id)
    `)
    // Just grab the newest one
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('--- REPORT FETCH ---');
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log(JSON.stringify(report, null, 2));
    const klass = Array.isArray(report.class) ? report.class[0] : report.class;
    console.log('Class object:', klass);
    console.log('Status:', report.status);
  }
}

check();


const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const envPath = path.resolve(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            env[key] = val;
        }
    });

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const blockIds = [
        'e4f4fa1a-c0b7-4d89-a2ef-075484bad4ba',
        'df2b2191-fb2e-4411-a510-69dc42278774'
    ];

    console.log('Fetching names for blocks:', blockIds);

    const { data: classBlocks, error } = await supabase
        .from('class_blocks')
        .select('id, block_id') // Get the generic block_id
        .in('id', blockIds);

    if (error) { console.error(error); return; }

    for (const cb of classBlocks) {
        const { data: b, error: bError } = await supabase
            .from('blocks')
            .select('name')
            .eq('id', cb.block_id)
            .single();

        console.log(`ClassBlock ID: ${cb.id} -> Block Name: ${b?.name}`);
    }
}

main().catch(console.error);

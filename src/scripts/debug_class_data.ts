
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual Env Parsing
const envPath = path.resolve(__dirname, '../../.env');
let supabaseUrl = '';
let supabaseServiceKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].trim().replace(/"/g, '');
        }
        if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
            supabaseServiceKey = line.split('=')[1].trim().replace(/"/g, '');
        }
    }
} catch (e) {
    console.error("Could not read .env.local", e);
}

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugClass(classId: string) {
    console.log(`Debugging Class: ${classId}`);

    // 1. Get Class with Coach
    const { data: klass } = await supabase.from('classes').select('*, users!classes_coach_id_fkey(username)').eq('id', classId).single();
    console.log('Class:', klass?.name);
    console.log('Coach Username:', klass?.users?.username);

    // 2. Get Sessions
    const { data: sessions } = await supabase.from('sessions').select('id, date_time, status').eq('class_id', classId).order('date_time', { ascending: true });
    console.log(`Sessions Found: ${sessions?.length}`);
    const futureSessions = sessions?.filter(s => new Date(s.date_time) > new Date());
    console.log(`Future Sessions: ${futureSessions?.length}`);

    // 3. Get Blocks
    const { data: blocks } = await supabase.from('class_blocks').select('id, status, block_id').eq('class_id', classId);
    console.log(`Blocks Found: ${blocks?.length}`);

    // 4. Get Lessons via Blocks
    for (const block of blocks || []) {
        const { data: lessons } = await supabase
            .from('class_lessons')
            .select('id, title, session_id, order_index')
            .eq('class_block_id', block.id);

        console.log(`Block ${block.id} (Template: ${block.block_id?.slice(0, 8)}...): ${lessons?.length} lessons`);
        const unassigned = lessons?.filter(l => !l.session_id);
        console.log(`   - Assigned: ${lessons?.filter(l => l.session_id).length}`);
        console.log(`   - Unassigned: ${unassigned?.length}`);
        if (unassigned?.length > 0) {
            console.log(`   - Sample Unassigned: ${unassigned[0].title} (Order: ${unassigned[0].order_index})`);
        }
    }
}

// Find a class to debug (e.g., first one found)
async function main() {
    const { data: classes } = await supabase.from('classes').select('id, name').limit(1);
    if (classes && classes.length > 0) {
        await debugClass(classes[0].id);
        // RESET PASSWORD logic
        if (klass?.users?.username === 'bagas') {
            const { data: nadia } = await supabase.from('users').select('password_hash').eq('username', 'coach.nadia').single();
            if (nadia?.password_hash) {
                console.log("Resetting bagas password to match coach.nadia (CoachToday#1)...");
                const { error } = await supabase.from('users').update({ password_hash: nadia.password_hash }).eq('username', 'bagas');
                if (error) console.error("Failed to reset password", error);
                else console.log("Password reset successful.");
            } else {
                console.log("Could not find coach.nadia to copy has from.");
            }
        }

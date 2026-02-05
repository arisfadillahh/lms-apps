
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
    // 1. Load .env manually
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

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials in .env');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });

    console.log('--- Checking Schedule ---');

    // 2. Find Coach
    const { data: coaches, error: coachError } = await supabase
        .from('users')
        .select('id, full_name, username')
        .ilike('full_name', '%tazia%');

    if (coachError) {
        console.error('Error finding coach:', coachError);
        return;
    }

    if (!coaches.length) {
        console.log('Coach "Tazia" not found.');
        return;
    }

    const coach = coaches[0];
    console.log(`Coach: ${coach.full_name} (${coach.username})`);

    // 3. Find Class (list all active classes for coach and filter by name)
    const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('coach_id', coach.id)
        .order('start_date', { ascending: true });

    if (classError) {
        console.error('Error finding classes:', classError);
        return;
    }

    const matchingClasses = classes.filter(c => c.name.toLowerCase().includes('xolorer') || c.name.toLowerCase().includes('explorer'));

    if (matchingClasses.length === 0) {
        console.log('No classes found matching "xolorer" or "explorer".');
        return;
    }

    console.log(`Found ${matchingClasses.length} matching classes:`);
    matchingClasses.forEach(c => console.log(`- ${c.name} (Start: ${c.start_date}) [ID: ${c.id}]`));

    // Pick the newest one
    const targetClass = matchingClasses.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0];
    console.log(`\nUsing newest class: ${targetClass.name} (Start: ${targetClass.start_date})`);

    // 4. Get Sessions
    const { data: sessions, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('class_id', targetClass.id)
        .order('date_time', { ascending: true });

    if (sessionError) {
        console.error('Error getting sessions:', sessionError);
        return;
    }

    console.log(`Found ${sessions.length} sessions.`);

    // 5. Get Lessons
    // We need blocks first to get keys? Or just query class_lessons via class_blocks?
    // Let's get blocks first to map correct IDs.
    const { data: blocks, error: blockError } = await supabase
        .from('class_blocks')
        .select('*')
        .eq('class_id', targetClass.id)
        .order('start_date', { ascending: true });

    if (blockError) {
        console.error('Error getting blocks:', blockError);
        return;
    }

    let allLessons = [];

    for (const block of blocks) {
        const { data: lessons, error: lessonError } = await supabase
            .from('class_lessons')
            .select(`
            *,
            lesson_templates (
                title
            )
        `)
            .eq('class_block_id', block.id)
            .order('order_index', { ascending: true });

        if (lessonError) {
            console.error(`Error getting lessons for block ${block.id}:`, lessonError);
            continue;
        }

        // Flatten structure
        const enriched = lessons.map(l => ({
            ...l,
            title: l.lesson_templates?.title || l.title || 'Untitled',
            block_id: block.id,
            block_name: block.name || 'Unnamed Block' // Assuming block object has 'name'? Let's check table schema if needed, usually class_blocks join with blocks?
            // Wait, 'class_blocks' table usually has a join to 'blocks' table.
            // In step 5, I did `supabase.from('class_blocks').select('*')`.
            // I need to select `blocks(name)` as well if I want the name.
        }));
        allLessons = [...allLessons, ...enriched];
    }

    console.log(`Found ${allLessons.length} lessons.`);

    // 6. List 12 sessions starting from Feb 7, 2026
    console.log('\n--- NEXT 12 LESSONS (Starting from Feb 7, 2026) ---');

    const targetDateStr = '2026-02-07';
    // Simple string comparison for our YYYY-MM-DD format logic, but dates are ISO.
    // We'll filter sessions >= Feb 7 2026.

    const targetDate = new Date(targetDateStr).getTime();

    // Find the first session on or after target date
    const startingSessionIndex = sessions.findIndex(s => new Date(s.date_time).getTime() >= targetDate);

    if (startingSessionIndex === -1) {
        console.log(`No sessions found on or after ${targetDateStr}.`);
        console.log('Latest session:', sessions[sessions.length - 1]?.date_time);
        return;
    }

    const upcomingSessions = sessions.slice(startingSessionIndex, startingSessionIndex + 12);

    console.log(`Starting from Session ${startingSessionIndex + 1} (Date: ${sessions[startingSessionIndex].date_time})`);

    upcomingSessions.forEach((session, idx) => {
        const sequenceNum = startingSessionIndex + 1 + idx;

        // Find lesson for this session
        const lesson = allLessons.find(l => l.session_id === session.id);

        const dateStr = new Date(session.date_time).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const lessonTitle = lesson ? lesson.title : '(No lesson assigned)';
        const blockInfo = lesson ? `[Block: ${lesson.block_id}]` : '';

        // We want to know the Block Name ideally, but we only have block_id in flattened allLessons (from my previous edit).
        // Let's print block_id for now, or find the block object if we still have it in scope?
        // In step 5 we iterated blocks. Let's make sure we kept block names.
        // Ah, I need to check how I constructed `allLessons` in step 5.

        console.log(`${sequenceNum}. ${lessonTitle} (${dateStr}) ${blockInfo}`);
    });
}

main().catch(console.error);

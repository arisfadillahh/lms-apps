
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

    const classId = '23a83a47-b026-4ead-9d26-50ed8a56a5ef'; // Explorer Sabtu

    // Step 0: Get Class Blocks (Needed for cleanup and sync)
    // Get all blocks for class
    const { data: classBlocks } = await supabase
        .from('class_blocks')
        .select('id, block_id')
        .eq('class_id', classId);

    if (!classBlocks) {
        console.log("No blocks found.");
        return;
    }

    // Step -1: Cleanup Orphans (Lessons with template_id that no longer exists in that block)
    console.log("Cleaning up orphans...");
    for (const cb of classBlocks) {
        if (!cb.block_id) continue;

        // Get valid template IDs
        const { data: templates } = await supabase
            .from('lesson_templates')
            .select('id')
            .eq('block_id', cb.block_id);

        const validTemplateIds = new Set((templates || []).map(t => t.id));

        // Get all lessons for this block
        const { data: myLessons } = await supabase
            .from('class_lessons')
            .select('id, lesson_template_id')
            .eq('class_block_id', cb.id);

        if (!myLessons) continue;

        const idsToDelete = [];
        for (const l of myLessons) {
            // If it has a template ID, but that ID is not in valid list -> Delete
            if (l.lesson_template_id && !validTemplateIds.has(l.lesson_template_id)) {
                idsToDelete.push(l.id);
            }
        }

        if (idsToDelete.length > 0) {
            console.log(`Deleting ${idsToDelete.length} orphan lessons in Block ${cb.id}`);
            await supabase.from('class_lessons').delete().in('id', idsToDelete);
        }
    }

    // Step 0.5: Sync Order Index from Templates
    console.log("Syncing order_index from templates...");

    for (const cb of classBlocks) {
        if (!cb.block_id) continue;

        // Get templates
        const { data: templates } = await supabase
            .from('lesson_templates')
            .select('id, title, order_index, summary, slide_url')
            .eq('block_id', cb.block_id);

        if (!templates) continue;

        // Update class_lessons matching these templates
        for (const t of templates) {
            // Update any lesson linked to this template
            // Note: Multi-part lessons usually have order_index = template.order * 1000 + part.
            // But if the user reordered the template, the BASE order changed.
            // We need to be careful not to overwrite the "Part" logic if we can't reconstruct it easily.
            // But here we can just update based on the assumption that we want to align with template.

            // Let's first get the lessons for this template
            const { data: myLessons } = await supabase
                .from('class_lessons')
                .select('id, title, order_index, summary, slide_url')
                .eq('class_block_id', cb.id)
                .eq('lesson_template_id', t.id);

            if (!myLessons) continue;

            for (let i = 0; i < myLessons.length; i++) {
                const l = myLessons[i];
                const partNum = i + 1;
                const expectedOrder = (t.order_index * 1000) + partNum;

                const updates = {};
                if (l.order_index !== expectedOrder) updates.order_index = expectedOrder;
                // Sync other fields too
                if (l.title !== t.title && !l.title.includes('(Part')) {
                    // Only sync title if it doesn't look like a multi-part title or if we are aggressive.
                    // Let's skip title sync to be safe, stick to order.
                }

                if (Object.keys(updates).length > 0) {
                    console.log(`Updating Lesson ${l.id} order to ${expectedOrder}`);
                    await supabase.from('class_lessons').update(updates).eq('id', l.id);
                }
            }
        }
    }

    // Re-implementing reassignLessonsToSessions here because we can't easily import the TS service in this JS script context without compilation
    // Step 1: Get Lessons (again, with fresh data)
    const { data: lessons, error: lessonError } = await supabase
        .from('class_lessons')
        .select(`
            id, 
            order_index, 
            class_blocks!inner (
                id,
                start_date,
                blocks (
                    order_index
                )
            )
        `)
        .eq('class_blocks.class_id', classId);

    if (lessonError) {
        console.error("Failed to fetch lessons", lessonError);
        return;
    }

    // Step 2: Sort
    const sortedLessons = lessons.sort((a, b) => {
        const blockOrderA = a.class_blocks?.blocks?.order_index ?? 0;
        const blockOrderB = b.class_blocks?.blocks?.order_index ?? 0;

        if (blockOrderA !== blockOrderB) {
            return blockOrderA - blockOrderB;
        }
        if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
        }
        return a.id.localeCompare(b.id);
    });

    console.log(`Fetched ${sortedLessons.length} lessons. First 5 IDs:`);
    sortedLessons.slice(0, 5).forEach(l => console.log(`- BlockOrder: ${l.class_blocks.blocks.order_index}, LessonOrder: ${l.order_index}`));

    // Step 3: Get Sessions
    const { data: validSessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id, date_time')
        .eq('class_id', classId)
        .neq('status', 'CANCELLED')
        .order('date_time', { ascending: true });

    if (sessionError) {
        console.error("Failed to fetch sessions", sessionError);
        return;
    }

    console.log(`Fetched ${validSessions.length} sessions.`);

    // Step 4: Update
    const chunkSize = 50;
    for (let i = 0; i < sortedLessons.length; i += chunkSize) {
        const chunk = sortedLessons.slice(i, i + chunkSize);
        const updatePromises = chunk.map((lesson, index) => {
            const globalIndex = i + index;
            const session = validSessions[globalIndex] || null;

            return supabase.from('class_lessons')
                .update({
                    session_id: session ? session.id : null,
                    unlock_at: session ? session.date_time : null
                })
                .eq('id', lesson.id);
        });
        await Promise.all(updatePromises);
    }

    console.log('Rebalance complete.');
}

main().catch(console.error);

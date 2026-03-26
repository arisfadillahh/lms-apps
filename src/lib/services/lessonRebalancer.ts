import { getSupabaseAdmin } from '@/lib/supabaseServer';

/**
 * Re-assigns lessons to valid sessions for a specific class - GLOBAL SCOPE.
 * This ensures "Rolling" behavior where a lesson spills over to the next block's session if needed.
 * It also handles multi-part lessons by ensuring they are assigned sequentially.
 *
 * IMPORTANT: We clear all session_id assignments first, then re-assign sequentially.
 * This prevents silent failures from UNIQUE constraints when swapping session_ids concurrently.
 */
export async function reassignLessonsToSessions(classId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    // 1. Get ALL lessons for the class, fetching Block Order Index for correct sorting
    const { data: lessons, error: lessonError } = await supabase
        .from('class_lessons')
        .select(`
            id, 
            order_index, 
            class_blocks!inner (
                id,
                class_id,
                blocks (
                    order_index
                )
            )
        `)
        .eq('class_blocks.class_id', classId);

    if (lessonError || !lessons) {
        console.error("[Rebalancer] Failed to fetch lessons for rebalance", lessonError);
        return;
    }

    if (lessons.length === 0) {
        console.log(`[Rebalancer] No lessons found for class ${classId}, skipping.`);
        return;
    }

    // Sort In-Memory to guarantee Curriculum Order (Block 1 -> Block 2 -> ...)
    const sortedLessons = lessons.sort((a: any, b: any) => {
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

    // 2. Get ALL Valid Sessions (non-cancelled), ordered chronologically
    const { data: validSessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id, date_time')
        .eq('class_id', classId)
        .neq('status', 'CANCELLED')
        .order('date_time', { ascending: true });

    if (sessionError || !validSessions) {
        console.error("[Rebalancer] Failed to fetch sessions for rebalance", sessionError);
        return;
    }

    const lessonIds = sortedLessons.map((l) => l.id);

    // 3. STEP 1: Clear ALL session_id assignments first to avoid UNIQUE constraint conflicts
    // This prevents the issue where two lessons transiently point to the same session during a swap.
    const { error: clearError } = await supabase
        .from('class_lessons')
        .update({ session_id: null, unlock_at: null })
        .in('id', lessonIds);

    if (clearError) {
        console.error("[Rebalancer] Failed to clear session assignments", clearError);
        return;
    }

    // 4. STEP 2: Re-assign lessons to valid sessions sequentially
    // We do this sequentially (not Promise.all) to ensure no constraint collisions.
    console.log(`[Rebalancer] Assigning ${sortedLessons.length} lessons to ${validSessions.length} valid sessions for class ${classId}`);

    for (let i = 0; i < sortedLessons.length; i++) {
        const lesson = sortedLessons[i];
        const session = validSessions[i] ?? null;

        const { error: updateError } = await supabase
            .from('class_lessons')
            .update({
                session_id: session ? session.id : null,
                unlock_at: session ? session.date_time : null,
            })
            .eq('id', lesson.id);

        if (updateError) {
            console.error(`[Rebalancer] Failed to update lesson ${lesson.id}:`, updateError);
        }
    }

    console.log(`[Rebalancer] Done rebalancing class ${classId}`);
}


/**
 * Syncs the structure of class_lessons (Part 1, Part 2...) with the current lesson_templates.
 * If a template says "Duration: 2", this ensures there are 2 class_lessons linked to it.
 * WARNING: This might delete class_lessons if duration was reduced.
 */
export async function syncClassLessonsStructure(classId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    // 1. Fetch all blocks for the class
    const { data: blocks } = await supabase
        .from('class_blocks')
        .select('id, block_id')
        .eq('class_id', classId);

    if (!blocks) return;

    for (const block of blocks) {
        if (!block.block_id) continue;

        // 2. Fetch templates for this block
        const { data: templates } = await supabase
            .from('lesson_templates')
            .select('*')
            .eq('block_id', block.block_id)
            .order('order_index');

        if (!templates) continue;

        // 3. Fetch existing class_lessons for this block
        const { data: existingLessons } = await supabase
            .from('class_lessons')
            .select('*')
            .eq('class_block_id', block.id);

        const existingMap = new Map<string, any[]>(); // template_id -> list of lessons
        existingLessons?.forEach(l => {
            if (!l.lesson_template_id) return;
            if (!existingMap.has(l.lesson_template_id)) existingMap.set(l.lesson_template_id, []);
            existingMap.get(l.lesson_template_id)?.push(l);
        });

        // 4. Compare and Fix
        for (const template of templates) {
            const targetCount = Math.max(1, template.estimated_meeting_count || 1);
            const currentLessons = existingMap.get(template.id) || [];

            // A. Expand if needed
            if (currentLessons.length < targetCount) {
                const needed = targetCount - currentLessons.length;
                const newPayloads = [];
                for (let i = 0; i < needed; i++) {
                    const partNum = currentLessons.length + i + 1;
                    let title = template.title;
                    if (targetCount > 1) title = `${template.title} (Part ${partNum})`;

                    newPayloads.push({
                        class_block_id: block.id,
                        lesson_template_id: template.id,
                        title: title,
                        summary: template.summary,
                        order_index: (template.order_index * 1000) + partNum,
                        slide_url: template.slide_url,
                        coach_example_url: template.example_url,
                        coach_example_storage_path: template.example_storage_path,
                        // session_id will be filled by rebalancer later
                    });
                }
                if (newPayloads.length > 0) {
                    await supabase.from('class_lessons').insert(newPayloads);
                }
            }

            // B. Shrink if needed (Delete extra parts from the end)
            if (currentLessons.length > targetCount) {
                // Sort by creation time or id (assuming higher ID = later part)
                // Actually, relying on title containing "Part X" is risky, ID sort is safer
                const sorted = currentLessons.sort((a, b) => a.id.localeCompare(b.id));
                const toDelete = sorted.slice(targetCount);
                const idsToDelete = toDelete.map(l => l.id);

                if (idsToDelete.length > 0) {
                    await supabase.from('class_lessons').delete().in('id', idsToDelete);
                }
            }

            // C. Rename params if duration changed from 1 to >1
            if (currentLessons.length === 1 && targetCount > 1) {
                const first = currentLessons[0];
                if (!first.title.includes('(Part 1)')) {
                    await supabase.from('class_lessons')
                        .update({ title: `${template.title} (Part 1)` })
                        .eq('id', first.id);
                }
            }

            // D. Sync Metadata (Order, Title, Summary, Slides) for ALL existing lessons
            for (let i = 0; i < currentLessons.length; i++) {
                const lesson = currentLessons[i];
                const partNum = i + 1;
                const expectedOrder = (template.order_index * 1000) + partNum;

                const updates: any = {};
                // Check and update fields
                if (lesson.order_index !== expectedOrder) updates.order_index = expectedOrder;
                if (lesson.summary !== template.summary) updates.summary = template.summary;
                if (lesson.slide_url !== template.slide_url) updates.slide_url = template.slide_url;

                let expectedTitle = template.title;
                if (targetCount > 1) expectedTitle = `${template.title} (Part ${partNum})`;

                if (lesson.title !== expectedTitle) updates.title = expectedTitle;

                if (Object.keys(updates).length > 0) {
                    await supabase.from('class_lessons').update(updates).eq('id', lesson.id);
                }
            }
        }
    }
}

/**
 * Propagates curriculum changes to all ACTIVE classes using this block.
 * Call this when a Lesson Template is created, updated, or deleted.
 */
export async function syncClassesForBlockTemplate(blockTemplateId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    // Find all class_blocks linked to this template
    const { data: classBlocks } = await supabase
        .from('class_blocks')
        .select('class_id, status')
        .eq('block_id', blockTemplateId)
        .in('status', ['CURRENT', 'UPCOMING']); // Only sync active/future blocks

    if (!classBlocks || classBlocks.length === 0) return;

    // Deduplicate class IDs
    const classIds = Array.from(new Set(classBlocks.map(cb => cb.class_id)));

    // Sync each class (Promise.all might be heavy, iterate for safety)
    for (const classId of classIds) {
        await syncClassLessonsStructure(classId);
        // Explicitly rebalance after structure sync
        const { reassignLessonsToSessions } = await import('@/lib/services/lessonRebalancer');
        await reassignLessonsToSessions(classId);
    }
}

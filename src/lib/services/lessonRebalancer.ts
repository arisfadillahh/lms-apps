import { getSupabaseAdmin } from '@/lib/supabaseServer';

/**
 * Re-assigns lessons to valid sessions for a specific class - GLOBAL SCOPE.
 * This ensures "Rolling" behavior where a lesson spills over to the next block's session if needed.
 * It also handles multi-part lessons by ensuring they are assigned sequentially.
 */
export async function reassignLessonsToSessions(classId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    // 1. Get ALL lessons for the class, fetching Block Order Index for correct sorting
    // We select nested blocks -> order_index to ensure we follow the curriculum sequence, not just dates.
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

    if (lessonError || !lessons) {
        console.error("Failed to fetch lessons for rebalance", lessonError);
        return;
    }

    // Sort In-Memory to guarantee Curriculum Order (Block 1 -> Block 2 -> ...)
    // This fixes the issue where "Jumping" dates caused lessons to be assigned out of order.
    const sortedLessons = lessons.sort((a: any, b: any) => {
        const blockOrderA = a.class_blocks?.blocks?.order_index ?? 0;
        const blockOrderB = b.class_blocks?.blocks?.order_index ?? 0;

        if (blockOrderA !== blockOrderB) {
            return blockOrderA - blockOrderB;
        }

        // Same block? Sort by lesson order index
        if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
        }

        // Stable tie-breaker
        return a.id.localeCompare(b.id);
    });

    // 2. Get ALL Valid Sessions (non-cancelled)
    const { data: validSessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id, date_time')
        .eq('class_id', classId)
        .neq('status', 'CANCELLED')
        .order('date_time', { ascending: true });

    if (sessionError || !validSessions) {
        console.error("Failed to fetch sessions for rebalance", sessionError);
        return;
    }

    // 3. Map Lessons to Valid Sessions sequentially
    const updates = [];
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
        updates.push(...updatePromises);
    }

    if (updates.length > 0) {
        await Promise.all(updates);
    }
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
            const targetCount = Math.max(1, template.duration_minutes || 1);
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
                        order_index: template.order_index,
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

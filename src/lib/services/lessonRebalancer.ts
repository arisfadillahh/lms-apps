import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { buildClassLessonOrderIndex, buildClassLessonTitle } from '@/lib/dao/classLessonsDao';
import { hasClassReachedTemplate, type LessonSessionSnapshot } from '@/lib/lessonTemplateSyncPolicy';

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

    // 1. Get ALL lessons for the class, fetching start_date for chronological sorting
    //    IMPORTANT: Sort by class_blocks.start_date (not blocks.order_index) to match
    //    lessonAutoAssign.ts behavior. This prevents lesson order from jumping/reversing
    //    when a class starts mid-curriculum (e.g. starting from Block 3).
    const { data: lessons, error: lessonError } = await supabase
        .from('class_lessons')
        .select(`
            id, 
            order_index, 
            class_blocks!inner (
                id,
                class_id,
                start_date
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

    // Sort by class_blocks.start_date (chronological), then by lesson order_index within block.
    // This matches the sort logic in lessonAutoAssign.ts (buildLessonQueue).
    const sortedLessons = lessons.sort((a: any, b: any) => {
        const dateA = new Date(a.class_blocks?.start_date ?? 0).getTime();
        const dateB = new Date(b.class_blocks?.start_date ?? 0).getTime();

        if (dateA !== dateB) {
            return dateA - dateB;
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
        .select('id, block_id, status')
        .eq('class_id', classId)
        .in('status', ['CURRENT', 'UPCOMING']);

    if (!blocks) return;

    for (const block of blocks) {
        if (!block.block_id) continue;

        // 2. Fetch templates for this block
        const { data: templates } = await supabase
            .from('lesson_templates')
            .select('*')
            .eq('block_id', block.block_id)
            .eq('is_archived', false)
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

        const sessionIds = (existingLessons ?? [])
            .map((lesson) => lesson.session_id)
            .filter((sessionId): sessionId is string => Boolean(sessionId));
        const sessionsById = new Map<string, LessonSessionSnapshot>();

        if (sessionIds.length > 0) {
            const { data: linkedSessions, error: sessionError } = await supabase
                .from('sessions')
                .select('id, date_time, status')
                .in('id', sessionIds);

            if (sessionError) {
                throw new Error(`Failed to inspect lesson session history: ${sessionError.message}`);
            }

            for (const session of linkedSessions ?? []) {
                sessionsById.set(session.id, session as LessonSessionSnapshot);
            }
        }

        // 4. Compare and Fix
        for (const template of templates) {
            const templateCount = Math.max(1, template.estimated_meeting_count || 1);
            const currentLessons = (existingMap.get(template.id) || []).slice().sort((a, b) => a.order_index - b.order_index);

            // A class keeps the lesson version it started with. Later global edits
            // must not add/remove parts or rewrite completed history.
            if (hasClassReachedTemplate(template.order_index, existingLessons ?? [], sessionsById)) {
                continue;
            }

            const extensionCount = currentLessons.filter((lesson) => lesson.is_extended === true).length;
            const targetCount = templateCount + extensionCount;
            let activeLessons = currentLessons;

            // A. Expand if needed
            if (currentLessons.length < targetCount) {
                const needed = targetCount - currentLessons.length;
                const newPayloads = [];
                for (let i = 0; i < needed; i++) {
                    const partNum = currentLessons.length + i + 1;

                    newPayloads.push({
                        class_block_id: block.id,
                        lesson_template_id: template.id,
                        title: buildClassLessonTitle(template.title, targetCount, partNum),
                        summary: template.summary,
                        order_index: buildClassLessonOrderIndex(template.order_index, partNum),
                        slide_url: template.slide_url,
                        coach_example_url: template.example_url,
                        coach_example_storage_path: template.example_storage_path,
                        // session_id will be filled by rebalancer later
                    });
                }
                if (newPayloads.length > 0) {
                    const { data: inserted, error: insertError } = await supabase
                        .from('class_lessons')
                        .insert(newPayloads)
                        .select('*');
                    if (insertError) {
                        throw new Error(`Failed to expand future lesson parts: ${insertError.message}`);
                    }
                    activeLessons = [...currentLessons, ...(inserted ?? [])]
                        .sort((a, b) => a.order_index - b.order_index);
                }
            }

            // B. Shrink template-owned parts if needed, but never delete class-scoped extensions.
            if (currentLessons.length > targetCount) {
                const templateOwnedLessons = currentLessons.filter((lesson) => lesson.is_extended !== true);
                const toDelete = templateOwnedLessons.slice(templateCount);
                const idsToDelete = toDelete.map(l => l.id);

                if (idsToDelete.length > 0) {
                    await supabase.from('class_lessons').delete().in('id', idsToDelete);
                }

                const deleted = new Set(idsToDelete);
                activeLessons = currentLessons.filter((lesson) => !deleted.has(lesson.id));
            }

            // C. Rename params if duration changed from 1 to >1
            if (activeLessons.length >= 1 && targetCount > 1) {
                const first = activeLessons[0];
                if (!first.title.includes('(Part 1)')) {
                    await supabase.from('class_lessons')
                        .update({ title: buildClassLessonTitle(template.title, targetCount, 1) })
                        .eq('id', first.id);
                }
            }

            // D. Sync metadata only while this lesson has not started.
            for (let i = 0; i < activeLessons.length; i++) {
                const lesson = activeLessons[i];
                const partNum = i + 1;
                const expectedOrder = buildClassLessonOrderIndex(template.order_index, partNum);

                const updates: any = {};
                // Check and update fields
                if (lesson.order_index !== expectedOrder) updates.order_index = expectedOrder;
                if (lesson.summary !== template.summary) updates.summary = template.summary;
                if (lesson.make_up_instructions !== template.make_up_instructions) updates.make_up_instructions = template.make_up_instructions;
                if (lesson.slide_url !== template.slide_url) updates.slide_url = template.slide_url;
                if (lesson.coach_example_url !== template.example_url) updates.coach_example_url = template.example_url;
                if (lesson.coach_example_storage_path !== template.example_storage_path) updates.coach_example_storage_path = template.example_storage_path;

                const expectedTitle = buildClassLessonTitle(template.title, targetCount, partNum);

                if (lesson.title !== expectedTitle) updates.title = expectedTitle;

                if (Object.keys(updates).length > 0) {
                    await supabase.from('class_lessons').update(updates).eq('id', lesson.id);
                }
            }
        }

        // Archived lesson history is intentionally retained. Future copies are removed
        // by archiveLessonSafely, which checks sessions and make-up references first.
    }
}

/**
 * Propagates curriculum changes only to lessons that have not started.
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
        const { autoAssignLessonsForClass } = await import('@/lib/services/lessonAutoAssign');
        await autoAssignLessonsForClass(classId, { mode: 'rebuild_future' });
    }
}

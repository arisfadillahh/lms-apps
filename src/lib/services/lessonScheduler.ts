// Lesson Scheduler Service - Computes lesson assignments dynamically

import { blocksDao, lessonTemplatesDao, sessionsDao } from '@/lib/dao';
import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import type { SessionRecord } from '@/lib/dao/sessionsDao';
import type { BlockRecord } from '@/lib/dao/blocksDao';

export type LessonSlot = {
    lessonTemplate: LessonTemplateRecord;
    block: BlockRecord;
    partNumber: number;      // 1 for first part, 2 for second part, etc.
    totalParts: number;      // Total parts for this lesson (based on duration)
    globalIndex: number;     // Position in the full curriculum cycle
};

export type SessionLessonMapping = {
    session: SessionRecord;
    lesson: LessonSlot | null;  // null if session is cancelled
};

/**
 * Builds an expanded list of lesson slots based on curriculum.
 * Each lesson template is expanded based on its estimated_meeting_count value.
 * estimated_meeting_count = 1 → 1 slot
 * estimated_meeting_count = 2 → 2 slots (Part 1, Part 2)
 * etc.
 */
async function buildLessonSlots(levelId: string): Promise<LessonSlot[]> {
    const blocks = await blocksDao.listBlocksByLevel(levelId);
    if (blocks.length === 0) return [];

    const slots: LessonSlot[] = [];
    let globalIndex = 0;

    for (const block of blocks) {
        const lessons = await lessonTemplatesDao.listLessonsByBlock(block.id);

        for (const lesson of lessons) {
            const totalParts = Math.max(1, lesson.estimated_meeting_count ?? 1);

            for (let part = 1; part <= totalParts; part++) {
                slots.push({
                    lessonTemplate: lesson,
                    block,
                    partNumber: part,
                    totalParts,
                    globalIndex,
                });
                globalIndex++;
            }
        }
    }

    return slots;
}


// Import classesDao to fetch class blocks
import { classesDao } from '@/lib/dao';

/**
 * Computes which lesson should be shown for each session.
 * 
 * UPDATED: Now reads from class_lessons (which may be filtered based on starting lesson)
 * instead of building from lesson_templates directly.
 * 
 * @param classId - The class to compute schedule for
 * @param levelId - The curriculum level
 * @param ekskulLessonPlanId - Optional Ekskul Lesson Plan ID
 * @returns Map of session ID to lesson slot
 */
export async function computeLessonSchedule(
    classId: string,
    levelId: string | null,
    ekskulLessonPlanId?: string | null,
): Promise<Map<string, LessonSlot>> {
    if (!levelId && !ekskulLessonPlanId) return new Map();

    const [sessions, classBlocks] = await Promise.all([
        sessionsDao.listSessionsByClass(classId),
        classesDao.getClassBlocks(classId),
    ]);

    // For Ekskul, use the old buildEkskulSlots approach
    if (ekskulLessonPlanId) {
        const lessonSlots = await buildEkskulSlots(ekskulLessonPlanId);
        if (lessonSlots.length === 0) return new Map();

        const activeSessions = sessions
            .filter(s => s.status !== 'CANCELLED')
            .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

        const result = new Map<string, LessonSlot>();
        activeSessions.forEach((session, index) => {
            const slotIndex = index % lessonSlots.length;
            result.set(session.id, lessonSlots[slotIndex]);
        });
        return result;
    }

    // For WEEKLY classes: Build slots from class_lessons (respects filtered lessons)
    let orderedSlots: LessonSlot[] = [];

    if (classBlocks.length > 0) {
        // Sort class blocks by start date
        const sortedBlocks = [...classBlocks].sort((a, b) =>
            new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        );

        // Build slots from class_lessons for each block
        const supabase = getSupabaseAdmin();
        let globalIndex = 0;

        for (const classBlock of sortedBlocks) {
            if (!classBlock.block_id) continue;

            // Get the block info
            const block = await blocksDao.getBlockById(classBlock.block_id);
            if (!block) continue;

            // Fetch class_lessons for this class_block
            const { data: classLessons } = await supabase
                .from('class_lessons')
                .select('*, lesson_templates(*)')
                .eq('class_block_id', classBlock.id)
                .order('order_index', { ascending: true });

            if (!classLessons || classLessons.length === 0) continue;

            // Group by lesson_template_id to calculate total parts per lesson
            const lessonGroups = new Map<string, any[]>();
            for (const cl of classLessons) {
                const templateId = cl.lesson_template_id;
                if (!templateId) continue;  // Skip if no template_id
                if (!lessonGroups.has(templateId)) {
                    lessonGroups.set(templateId, []);
                }
                lessonGroups.get(templateId)!.push(cl);
            }

            for (const cl of classLessons) {
                const lessonTemplate = cl.lesson_templates as unknown as LessonTemplateRecord | null;
                if (!lessonTemplate) continue;

                const templateId = cl.lesson_template_id;
                if (!templateId) continue;

                // Calculate total parts for this lesson
                const totalParts = lessonGroups.get(templateId)?.length || 1;

                // Parse part number from title if it contains "(Part X)"
                let partNumber = 1;
                const partMatch = cl.title?.match(/\(Part (\d+)\)/);
                if (partMatch) {
                    partNumber = parseInt(partMatch[1], 10);
                } else if (totalParts > 1) {
                    // If no Part in title but multiple parts exist, find position
                    const group = lessonGroups.get(templateId) || [];
                    partNumber = group.findIndex((g: any) => g.id === cl.id) + 1;
                }

                orderedSlots.push({
                    lessonTemplate,
                    block,
                    partNumber,
                    totalParts,
                    globalIndex,
                });
                globalIndex++;
            }
        }
    }

    // Fallback: If no class_lessons exist, use old approach (for backwards compatibility)
    if (orderedSlots.length === 0 && levelId) {
        orderedSlots = await buildLessonSlots(levelId);
    }

    if (orderedSlots.length === 0) return new Map();

    // Only consider active (non-cancelled) sessions, sorted by date
    const activeSessions = sessions
        .filter(s => s.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    const result = new Map<string, LessonSlot>();

    activeSessions.forEach((session, index) => {
        // Cycle through lessons using modulo
        const slotIndex = index % orderedSlots.length;
        result.set(session.id, orderedSlots[slotIndex]);
    });

    return result;
}

import { getSupabaseAdmin } from '@/lib/supabaseServer';

async function buildEkskulSlots(planId: string): Promise<LessonSlot[]> {
    const supabase = getSupabaseAdmin();
    const { data: lessons } = await supabase
        .from('ekskul_lessons')
        .select('*')
        .eq('plan_id', planId)
        .order('order_index', { ascending: true });

    if (!lessons || lessons.length === 0) return [];

    const slots: LessonSlot[] = [];
    let globalIndex = 0;

    // Create a dummy block for Ekskul lessons
    const dummyBlock: BlockRecord = {
        id: 'ekskul-block',
        level_id: 'ekskul',
        name: 'Ekskul',
        summary: null,
        order_index: 0,
        estimated_sessions: 0,
        is_published: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    for (const lesson of lessons) {
        const totalParts = Math.max(1, lesson.estimated_meetings || 1);

        // Map EkskulLesson to LessonTemplateRecord shape
        const lessonTemplate: LessonTemplateRecord = {
            id: lesson.id,
            block_id: 'ekskul-block',
            title: lesson.title,
            summary: lesson.summary,
            slide_url: lesson.slide_url,
            example_url: lesson.example_url,
            estimated_meeting_count: lesson.estimated_meetings,
            order_index: lesson.order_index,
            created_at: lesson.created_at,
            updated_at: new Date().toISOString(), // Default if missing
            example_storage_path: null,
            make_up_instructions: null,
        };

        for (let part = 1; part <= totalParts; part++) {
            slots.push({
                lessonTemplate,
                block: dummyBlock,
                partNumber: part,
                totalParts,
                globalIndex,
            });
            globalIndex++;
        }
    }

    return slots;
}


/**
 * Gets the full schedule with both active and cancelled sessions.
 * Useful for displaying in UI where you need to show all sessions.
 */
export async function getFullSessionSchedule(
    classId: string,
    levelId: string | null,
): Promise<SessionLessonMapping[]> {
    if (!levelId) {
        const sessions = await sessionsDao.listSessionsByClass(classId);
        return sessions.map(session => ({ session, lesson: null }));
    }

    const [sessions, lessonMap] = await Promise.all([
        sessionsDao.listSessionsByClass(classId),
        computeLessonSchedule(classId, levelId),
    ]);

    const sortedSessions = [...sessions].sort(
        (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
    );

    return sortedSessions.map(session => ({
        session,
        lesson: session.status === 'CANCELLED' ? null : lessonMap.get(session.id) ?? null,
    }));
}

/**
 * Helper to format lesson title with part number if needed.
 */
export function formatLessonTitle(slot: LessonSlot): string {
    if (slot.totalParts > 1) {
        return `${slot.lessonTemplate.title} (Part ${slot.partNumber})`;
    }
    return slot.lessonTemplate.title;
}

/**
 * Gets lesson slots (curriculum structure) for a level.
 * Useful for displaying total lessons count, etc.
 */
export async function getLessonSlotsForLevel(levelId: string): Promise<LessonSlot[]> {
    return buildLessonSlots(levelId);
}

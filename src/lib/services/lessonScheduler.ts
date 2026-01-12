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
 * Logic:
 * 1. Filter out CANCELLED sessions (they don't get lessons)
 * 2. Active sessions are numbered 0, 1, 2, 3...
 * 3. Each active session gets a lesson based on (sessionIndex % totalLessonSlots)
 * 4. This creates cycling behavior: after all lessons, start from Block 1 again
 * 
 * UPDATE: Checks for class_blocks to determine the correct order of lessons.
 * If class starts at Block 3, lessons will be ordered starting from Block 3 lessons.
 * 
 * @param classId - The class to compute schedule for
 * @param levelId - The curriculum level
 * @returns Map of session ID to lesson slot
 */
export async function computeLessonSchedule(
    classId: string,
    levelId: string | null,
): Promise<Map<string, LessonSlot>> {
    if (!levelId) return new Map();

    const [sessions, lessonSlots, classBlocks] = await Promise.all([
        sessionsDao.listSessionsByClass(classId),
        buildLessonSlots(levelId),
        classesDao.getClassBlocks(classId),
    ]);

    if (lessonSlots.length === 0) return new Map();

    // Re-order lessonSlots based on classBlocks order if available
    let orderedSlots = lessonSlots;
    if (classBlocks.length > 0) {
        // Sort class blocks by start date
        const sortedBlocks = [...classBlocks].sort((a, b) =>
            new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        );

        // Extract block IDs in order
        const blockOrder = sortedBlocks.map(b => b.block_id);

        // Group slots by block ID
        const slotsByBlock = new Map<string, LessonSlot[]>();
        lessonSlots.forEach(slot => {
            const bid = slot.block.id;
            if (!slotsByBlock.has(bid)) slotsByBlock.set(bid, []);
            slotsByBlock.get(bid)!.push(slot);
        });

        // Reconstruct orderedSlots
        const newOrder: LessonSlot[] = [];
        // 1. Add slots for blocks in classBlocks order
        for (const blockId of blockOrder) {
            if (slotsByBlock.has(blockId)) {
                newOrder.push(...slotsByBlock.get(blockId)!);
                slotsByBlock.delete(blockId); // Remove so we don't add again
            }
        }
        // 2. Append any remaining blocks (those not in classBlocks for some reason)
        for (const [_, slots] of slotsByBlock) {
            newOrder.push(...slots);
        }

        if (newOrder.length > 0) {
            orderedSlots = newOrder;
        }
    }

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

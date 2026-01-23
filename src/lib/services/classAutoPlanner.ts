import { addDays } from 'date-fns';

import type { TablesRow } from '@/types/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { classLessonsDao, lessonTemplatesDao, sessionsDao } from '@/lib/dao';
import { createClassBlock, updateClass } from '@/lib/dao/classesDao';

import { DAY_CODE_MAP } from '@/lib/constants/scheduleConstants';

type ClassRow = TablesRow<'classes'>;

type AutoPlanResult =
  | { skipped: true; reason: string }
  | { skipped: false; blockId: string; sessionsCreated: number };

function normalizeScheduleDay(scheduleDay: string): { code: 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'; index: number } | null {
  const normalized = scheduleDay.trim().toUpperCase();
  return DAY_CODE_MAP[normalized] ?? null;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function alignDateToWeekday(start: Date, targetIndex: number): Date {
  const aligned = new Date(start);
  const currentIndex = aligned.getDay();
  const delta = (targetIndex - currentIndex + 7) % 7;
  aligned.setDate(aligned.getDate() + delta);
  return aligned;
}

function computeSessionDates(first: Date, count: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    dates.push(addDays(first, i * 7));
  }
  return dates;
}

export async function autoPlanWeeklyClass(classRecord: ClassRow, preferredStartBlockId?: string, preferredStartLessonId?: string): Promise<AutoPlanResult> {
  if (classRecord.type !== 'WEEKLY') {
    return { skipped: true, reason: 'Not a weekly class' };
  }
  if (!classRecord.level_id) {
    return { skipped: true, reason: 'Class missing level id' };
  }

  const supabase = getSupabaseAdmin();

  // check existing blocks
  {
    const { data: existingBlock, error } = await supabase
      .from('class_blocks')
      .select('id')
      .eq('class_id', classRecord.id)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to check existing class blocks: ${error.message}`);
    }
    if (existingBlock) {
      return { skipped: true, reason: 'Class already has blocks' };
    }
  }

  // Fetch ALL blocks from the level (curriculum)
  const { data: allBlocks, error: blocksError } = await supabase
    .from('blocks')
    .select('id, estimated_sessions, order_index, level_id, name')
    .eq('level_id', classRecord.level_id)
    .order('order_index', { ascending: true });

  if (blocksError) {
    throw new Error(`Failed to fetch level blocks: ${blocksError.message}`);
  }

  if (!allBlocks || allBlocks.length === 0) {
    return { skipped: true, reason: 'No blocks found for level' };
  }

  const scheduleInfo = normalizeScheduleDay(classRecord.schedule_day);
  if (!scheduleInfo) {
    return { skipped: true, reason: `Invalid schedule day "${classRecord.schedule_day}"` };
  }

  // Pre-calculate session offset for migration (Backfill logic)
  let pastSessionCount = 0;
  let targetFound = false;

  // If no preference is given, we start at the beginning (offset 0)
  if (!preferredStartBlockId && !preferredStartLessonId) {
    targetFound = true;
  }

  const classStart = new Date(classRecord.start_date ?? new Date().toISOString());

  // Phase 1: Count how many sessions should be "Backdated/Completed"
  // We strictly iterate ALL blocks now, ignoring startingBlockIndex skipping
  for (const block of allBlocks) {
    if (targetFound) break;

    // If target is block-based (and we hit the block), we stop counting at the START of this block
    if (preferredStartBlockId && block.id === preferredStartBlockId && !preferredStartLessonId) {
      targetFound = true;
      break;
    }

    const lessonTemplates = await lessonTemplatesDao.listLessonsByBlock(block.id);

    for (const lesson of lessonTemplates) {
      if (preferredStartLessonId && lesson.id === preferredStartLessonId) {
        targetFound = true;
        break;
      }

      // Add to past count
      const meetingCount = Math.max(1, lesson.estimated_meeting_count ?? 1);
      pastSessionCount += meetingCount;
    }
  }

  // Phase 2: Execution
  // Start date is shifted back by the number of past sessions
  // We use strict weekly intervals (7 days) for the history
  let currentStartDate = addDays(classStart, -(pastSessionCount * 7));
  let totalSessionsCreated = 0;
  let firstBlockId: string | null = null;
  let accumulatedSessionCount = 0; // Track global session index to determine status

  // Create class_blocks for ALL blocks in the level (No longer skipping blocks)
  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i];
    const isFirst = i === 0;

    const lessonTemplates = await lessonTemplatesDao.listLessonsByBlock(block.id);
    // Note: We no longer filter lessons here. We process ALL lessons.

    let sessionsRequired = block.estimated_sessions ?? lessonTemplates.length;
    if (!sessionsRequired || sessionsRequired <= 0) {
      sessionsRequired = Math.max(lessonTemplates.length, 1);
    }

    const sessionDates = computeSessionDates(currentStartDate, sessionsRequired);
    const lastSessionDate = sessionDates[sessionDates.length - 1];

    const blockStartDate = toDateOnly(currentStartDate);
    const blockEndDate = toDateOnly(lastSessionDate);

    // Determine Block Status
    // If all sessions in this block are in the past -> COMPLETED
    // If mixed or current -> CURRENT (or UPCOMING if we haven't reached it)
    // Simplified: Check if we have passed the migration point completely
    let status: 'CURRENT' | 'UPCOMING' | 'COMPLETED' = 'UPCOMING';

    // We calculate the range of global session indices for this block
    const blockStartSessionIndex = accumulatedSessionCount;
    const blockEndSessionIndex = accumulatedSessionCount + sessionsRequired;

    if (blockEndSessionIndex <= pastSessionCount) {
      status = 'COMPLETED';
    } else if (blockStartSessionIndex < pastSessionCount && blockEndSessionIndex > pastSessionCount) {
      status = 'CURRENT';
    } else if (blockStartSessionIndex === pastSessionCount) {
      status = 'CURRENT';
    } else {
      status = 'UPCOMING';
    }

    const classBlock = await createClassBlock({
      classId: classRecord.id,
      blockId: block.id,
      startDate: blockStartDate,
      endDate: blockEndDate,
      pitchingDayDate: blockEndDate,
      status: status as 'CURRENT' | 'UPCOMING', // Type cast for safety if enum restriction exists
    });

    if (isFirst) {
      firstBlockId = classBlock.id;
    }

    // Create class_lessons
    if (lessonTemplates.length > 0) {
      const expandedLessons: Array<{
        class_block_id: string;
        lesson_template_id: string;
        title: string;
        summary: string | null;
        order_index: number;
        make_up_instructions: string | null;
        slide_url: string | null;
        coach_example_url: string | null;
        coach_example_storage_path: string | null;
        session_id?: string; // We will mistakenly not assign session_id here, but need to assign it later?
        // Wait, createClassLessons doesn't take session_id. 
        // Valid point. Sessions are created later/concurrently?
        // Ah, session generation logic is below (implied but not shown in original file? No, it IS NOT in original file)
        // Wait, original file DOES NOT create sessions for Weekly classes here?
        // Checks original file... 
        // Original file: 
        // 1. Create Class Block
        // 2. Create Class Lessons
        // 3. Move Start Date
        // 4. End Loop
        // 5. sessionsDao.ensureFutureSessions() <--- THIS creates the sessions!
      }> = [];

      let orderIndex = 1;

      for (const lesson of lessonTemplates) {
        const meetingCount = Math.max(1, lesson.estimated_meeting_count ?? 1);

        for (let part = 1; part <= meetingCount; part++) {
          let title = lesson.title;
          if (meetingCount > 1) {
            title = `${lesson.title} (Part ${part})`;
          }

          expandedLessons.push({
            class_block_id: classBlock.id,
            lesson_template_id: lesson.id,
            title,
            summary: lesson.summary ?? null,
            order_index: orderIndex++,
            make_up_instructions: lesson.make_up_instructions ?? null,
            slide_url: lesson.slide_url ?? null,
            coach_example_url: lesson.example_url ?? null,
            coach_example_storage_path: lesson.example_storage_path ?? null,
          });
        }
      }

      if (expandedLessons.length > 0) {
        await classLessonsDao.createClassLessons(expandedLessons);
      }
    }

    // Move start date to after this block ends
    currentStartDate = addDays(lastSessionDate, 7);
    totalSessionsCreated += sessionsRequired;
    accumulatedSessionCount += sessionsRequired; // Advance global counter
  }

  // Ensure sessions are generated (including the backdated ones)
  // ensureFutureSessions generates sessions starting from Last Session Date.
  // Since we have NO sessions yet, it will look at class_start_date. 
  // PROBLEM: ensureFutureSessions uses Date.now() or class_start_date.
  // We physically need to force it to start generating from our calculated `currentStartDate` (the backdated one).

  // We need to MANUALLY generate the initial batch of sessions here because ensureFutureSessions 
  // is designed for "Future" rolling updates, not "Past" backfills.

  // Actually, we can just call generateSessions directly for the whole range we just calculated.
  const fullScheduleInfo = normalizeScheduleDay(classRecord.schedule_day);
  if (fullScheduleInfo) {
    // Re-calculate the very first start date
    const initialDate = addDays(classStart, -(pastSessionCount * 7));
    const alignedInitial = alignDateToWeekday(initialDate, fullScheduleInfo.index);

    // Calculate end date (active horizon)
    // We want to generate enough sessions for Past + say 12 weeks Future
    const horizonWeeks = pastSessionCount + 12;
    const targetEndDate = addDays(alignedInitial, horizonWeeks * 7);

    const generatedSessions = await sessionsDao.generateSessions({
      classId: classRecord.id,
      startDate: toDateOnly(alignedInitial),
      endDate: toDateOnly(targetEndDate),
      byDay: [fullScheduleInfo.code],
      time: classRecord.schedule_time,
    });

    // KEY STEP: Mark past sessions as COMPLETED
    // We rely on the order of generated sessions (should be chronological)
    if (generatedSessions.length > 0) {
      // Sort just in case
      generatedSessions.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

      // Mark the first `pastSessionCount` sessions as COMPLETED
      const pastSessionsToUpdate = generatedSessions.slice(0, pastSessionCount);

      await Promise.all(pastSessionsToUpdate.map(s =>
        sessionsDao.updateSessionStatus(s.id, 'COMPLETED')
      ));
    }

    // Assign lessons to these sessions
    const { reassignLessonsToSessions } = await import('@/lib/services/lessonRebalancer');
    await reassignLessonsToSessions(classRecord.id);
  }

  // Ensure 12 weeks buffer of sessions
  await sessionsDao.ensureFutureSessions(classRecord.id);

  // Extend class end date if needed
  const finalBlock = allBlocks[allBlocks.length - 1]; // Simply last block
  const lessonTemplatesLast = await lessonTemplatesDao.listLessonsByBlock(finalBlock.id);
  let lastBlockSessions = finalBlock.estimated_sessions ?? lessonTemplatesLast.length;
  if (!lastBlockSessions || lastBlockSessions <= 0) {
    lastBlockSessions = Math.max(lessonTemplatesLast.length, 1);
  }
  // Calculate approximate end date of the last block
  const totalWeeks = allBlocks.reduce((sum, b) => sum + (b.estimated_sessions ?? 1), 0);
  const approxEndDate = addDays(classStart, totalWeeks * 7);
  if (classRecord.end_date && new Date(classRecord.end_date) < approxEndDate) {
    await updateClass(classRecord.id, { endDate: toDateOnly(approxEndDate) });
  }

  return { skipped: false, blockId: firstBlockId ?? '', sessionsCreated: totalSessionsCreated };
}

/**
 * Auto-plan ekskul class based on ekskul_lesson_plan
 */
export async function autoPlanEkskulClass(classRecord: ClassRow): Promise<AutoPlanResult> {
  if (classRecord.type !== 'EKSKUL') {
    return { skipped: true, reason: 'Not an ekskul class' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ekskulLessonPlanId = (classRecord as any).ekskul_lesson_plan_id;
  if (!ekskulLessonPlanId) {
    return { skipped: true, reason: 'No ekskul lesson plan assigned' };
  }

  const supabase = getSupabaseAdmin();

  // Check if sessions already exist
  const { data: existingSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('class_id', classRecord.id)
    .limit(1);

  if (existingSessions && existingSessions.length > 0) {
    return { skipped: true, reason: 'Sessions already exist for this class' };
  }

  // Fetch ekskul lessons from the plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ekskulLessons, error: lessonsError } = await (supabase as any)
    .from('ekskul_lessons')
    .select('*')
    .eq('plan_id', ekskulLessonPlanId)
    .order('order_index', { ascending: true });

  if (lessonsError) {
    console.error('Error fetching ekskul lessons:', lessonsError);
    return { skipped: true, reason: 'Failed to fetch ekskul lessons' };
  }

  if (!ekskulLessons || ekskulLessons.length === 0) {
    return { skipped: true, reason: 'No lessons in ekskul plan' };
  }

  const scheduleInfo = normalizeScheduleDay(classRecord.schedule_day);
  if (!scheduleInfo) {
    return { skipped: true, reason: `Invalid schedule day "${classRecord.schedule_day}"` };
  }

  const classStart = new Date(classRecord.start_date ?? new Date().toISOString());
  let currentDate = alignDateToWeekday(classStart, scheduleInfo.index);
  let totalSessionsCreated = 0;

  // Create sessions for each ekskul lesson
  const sessionsToCreate: Array<{
    class_id: string;
    date_time: string;
    zoom_link_snapshot: string;
    status: 'SCHEDULED';
  }> = [];

  for (const lesson of ekskulLessons) {
    const lessonMeetings = lesson.estimated_meetings || 1;

    for (let meeting = 0; meeting < lessonMeetings; meeting++) {
      const sessionDate = toDateOnly(currentDate);
      // Combine date and time into ISO datetime string with Explicit +07:00 (WIB) offset
      const dateTime = `${sessionDate}T${classRecord.schedule_time}:00+07:00`;

      sessionsToCreate.push({
        class_id: classRecord.id,
        date_time: dateTime,
        zoom_link_snapshot: classRecord.zoom_link,
        status: 'SCHEDULED',
      });

      // Move to next week
      currentDate = addDays(currentDate, 7);
      totalSessionsCreated++;
    }
  }

  // Batch insert all sessions
  if (sessionsToCreate.length > 0) {
    const { error: insertError } = await supabase
      .from('sessions')
      .insert(sessionsToCreate);

    if (insertError) {
      console.error('Error creating ekskul sessions:', insertError);
      return { skipped: true, reason: 'Failed to create sessions' };
    }
  }

  return { skipped: false, blockId: '', sessionsCreated: totalSessionsCreated };
}


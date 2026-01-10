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

export async function autoPlanWeeklyClass(classRecord: ClassRow, preferredStartBlockId?: string): Promise<AutoPlanResult> {
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

  // Determine starting block index
  let startingBlockIndex = 0;
  if (preferredStartBlockId) {
    const preferredIndex = allBlocks.findIndex((b) => b.id === preferredStartBlockId);
    if (preferredIndex >= 0) {
      startingBlockIndex = preferredIndex;
    }
  }

  const classStart = new Date(classRecord.start_date ?? new Date().toISOString());
  let currentStartDate = alignDateToWeekday(classStart, scheduleInfo.index);
  let totalSessionsCreated = 0;
  let firstBlockId: string | null = null;

  // Create class_blocks for ALL blocks in the level
  for (let i = 0; i < allBlocks.length; i++) {
    const blockIndex = (startingBlockIndex + i) % allBlocks.length;
    const block = allBlocks[blockIndex];
    const isFirst = i === 0;

    const lessonTemplates = await lessonTemplatesDao.listLessonsByBlock(block.id);
    let sessionsRequired = block.estimated_sessions ?? lessonTemplates.length;
    if (!sessionsRequired || sessionsRequired <= 0) {
      sessionsRequired = Math.max(lessonTemplates.length, 1);
    }

    const sessionDates = computeSessionDates(currentStartDate, sessionsRequired);
    const lastSessionDate = sessionDates[sessionDates.length - 1];

    const blockStartDate = toDateOnly(currentStartDate);
    const blockEndDate = toDateOnly(lastSessionDate);

    // Determine status: first block is CURRENT, rest are UPCOMING
    const status: 'CURRENT' | 'UPCOMING' = isFirst ? 'CURRENT' : 'UPCOMING';

    const classBlock = await createClassBlock({
      classId: classRecord.id,
      blockId: block.id,
      startDate: blockStartDate,
      endDate: blockEndDate,
      pitchingDayDate: blockEndDate,
      status,
    });

    if (isFirst) {
      firstBlockId = classBlock.id;
    }

    // Create class_lessons for this block
    if (lessonTemplates.length > 0) {
      await classLessonsDao.createClassLessons(
        lessonTemplates.map((lesson) => ({
          class_block_id: classBlock.id,
          lesson_template_id: lesson.id,
          title: lesson.title,
          summary: lesson.summary ?? null,
          order_index: lesson.order_index,
          make_up_instructions: lesson.make_up_instructions ?? null,
          slide_url: lesson.slide_url ?? null,
          coach_example_url: lesson.example_url ?? null,
          coach_example_storage_path: lesson.example_storage_path ?? null,
        })),
      );
    }

    // Move start date to after this block ends
    currentStartDate = addDays(lastSessionDate, 7);
    totalSessionsCreated += sessionsRequired;
  }

  // Ensure 12 weeks buffer of sessions
  await sessionsDao.ensureFutureSessions(classRecord.id);

  // Extend class end date if needed
  const lastBlock = allBlocks[(startingBlockIndex + allBlocks.length - 1) % allBlocks.length];
  const lessonTemplatesLast = await lessonTemplatesDao.listLessonsByBlock(lastBlock.id);
  let lastBlockSessions = lastBlock.estimated_sessions ?? lessonTemplatesLast.length;
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

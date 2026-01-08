import { addDays } from 'date-fns';

import type { TablesRow } from '@/types/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { classLessonsDao, lessonTemplatesDao, sessionsDao } from '@/lib/dao';
import { createClassBlock, updateClass } from '@/lib/dao/classesDao';

const DAY_CODE_MAP: Record<string, { code: 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA'; index: number }> = {
  SU: { code: 'SU', index: 0 },
  SUN: { code: 'SU', index: 0 },
  SUNDAY: { code: 'SU', index: 0 },
  MO: { code: 'MO', index: 1 },
  MON: { code: 'MO', index: 1 },
  MONDAY: { code: 'MO', index: 1 },
  TU: { code: 'TU', index: 2 },
  TUE: { code: 'TU', index: 2 },
  TUESDAY: { code: 'TU', index: 2 },
  WE: { code: 'WE', index: 3 },
  WED: { code: 'WE', index: 3 },
  WEDNESDAY: { code: 'WE', index: 3 },
  TH: { code: 'TH', index: 4 },
  THU: { code: 'TH', index: 4 },
  THURSDAY: { code: 'TH', index: 4 },
  FR: { code: 'FR', index: 5 },
  FRI: { code: 'FR', index: 5 },
  FRIDAY: { code: 'FR', index: 5 },
  SA: { code: 'SA', index: 6 },
  SAT: { code: 'SA', index: 6 },
  SATURDAY: { code: 'SA', index: 6 },
};

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

  // fetch block template for level
  let { data: blockTemplate, error: blockError } = await supabase
    .from('blocks')
    .select('id, estimated_sessions, order_index, level_id')
    .eq('id', preferredStartBlockId ?? '')
    .maybeSingle();

  if (blockError) {
    throw new Error(`Failed to lookup block template: ${blockError.message}`);
  }

  if (!blockTemplate || blockTemplate.level_id !== classRecord.level_id) {
    const { data: firstBlock, error: firstError } = await supabase
      .from('blocks')
      .select('id, estimated_sessions, order_index')
      .eq('level_id', classRecord.level_id)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstError) {
      throw new Error(`Failed to lookup block template: ${firstError.message}`);
    }
    blockTemplate = firstBlock;
  }

  if (!blockTemplate) {
    return { skipped: true, reason: 'No block template found for level' };
  }

  const lessonTemplates = await lessonTemplatesDao.listLessonsByBlock(blockTemplate.id);

  let sessionsRequired = blockTemplate.estimated_sessions ?? lessonTemplates.length;
  if (!sessionsRequired || sessionsRequired <= 0) {
    sessionsRequired = Math.max(lessonTemplates.length, 1);
  }

  const scheduleInfo = normalizeScheduleDay(classRecord.schedule_day);
  if (!scheduleInfo) {
    return { skipped: true, reason: `Invalid schedule day "${classRecord.schedule_day}"` };
  }

  const classStart = new Date(classRecord.start_date ?? new Date().toISOString());
  const firstSessionDate = alignDateToWeekday(classStart, scheduleInfo.index);
  const sessionDates = computeSessionDates(firstSessionDate, sessionsRequired);
  const lastSessionDate = sessionDates[sessionDates.length - 1];

  // generate sessions
  const generatedSessions = await sessionsDao.generateSessions({
    classId: classRecord.id,
    startDate: toDateOnly(firstSessionDate),
    endDate: toDateOnly(lastSessionDate),
    byDay: [scheduleInfo.code],
    time: classRecord.schedule_time,
    zoomLinkSnapshot: undefined,
  });

  const blockStartDate = toDateOnly(firstSessionDate);
  const blockEndDate = toDateOnly(lastSessionDate);

  const classBlock = await createClassBlock({
    classId: classRecord.id,
    blockId: blockTemplate.id,
    startDate: blockStartDate,
    endDate: blockEndDate,
    pitchingDayDate: blockEndDate,
    status: 'CURRENT',
  });

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

  // extend class end date if needed to cover block schedule
  if (classRecord.end_date && new Date(classRecord.end_date) < lastSessionDate) {
    await updateClass(classRecord.id, { endDate: blockEndDate });
  }

  return { skipped: false, blockId: classBlock.id, sessionsCreated: generatedSessions.length };
}

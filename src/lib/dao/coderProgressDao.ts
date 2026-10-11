import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { CoderJourneyProgressRow } from '@/lib/coderJourney';
import type { BlockRecord } from '@/lib/dao/blocksDao';
import { createAdminNotifications, createNotification } from '@/lib/dao/notificationsDao';

type EnsureJourneyParams = {
  coderId: string;
  levelId: string;
  blocks: BlockRecord[];
  entryBlockId?: string | null;
};

export async function ensureJourneyForCoder({ coderId, levelId, blocks, entryBlockId }: EnsureJourneyParams): Promise<void> {
  if (!coderId || !levelId || blocks.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();

  // Fetch fully to check order
  const { data: existing, error } = await supabase
    .from('coder_block_progress')
    .select('*')
    .eq('coder_id', coderId)
    .eq('level_id', levelId)
    .order('journey_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to check coder progress: ${error.message}`);
  }

  if (existing && existing.length > 0) {
    // Existing rows are the Coder's curriculum snapshot. A later global
    // curriculum edit must not silently add requirements to an active journey.
    return;
  }

  const orderedBlockIds = computeJourneyOrder(blocks);
  const entryIndex = entryBlockId ? orderedBlockIds.indexOf(entryBlockId) : 0;
  const startIndex = entryIndex >= 0 ? entryIndex : 0;
  const wrappedBlockIds = [
    ...orderedBlockIds.slice(startIndex),
    ...orderedBlockIds.slice(0, startIndex),
  ];

  const payload = wrappedBlockIds.map((blockId, index) => ({
    coder_id: coderId,
    level_id: levelId,
    block_id: blockId,
    journey_order: index,
    status: (index === 0 ? 'IN_PROGRESS' : 'PENDING') as 'IN_PROGRESS' | 'PENDING' | 'COMPLETED',
  }));

  const insertResult = await supabase.from('coder_block_progress').insert(payload);
  if (insertResult.error) {
    throw new Error(`Failed to seed coder block journey: ${insertResult.error.message}`);
  }
}

export async function reconcileCompletedLevelsForClass(classId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: klass, error: classError } = await supabase
    .from('classes').select('level_id, type').eq('id', classId).maybeSingle();
  if (classError) throw new Error(`Failed to load class: ${classError.message}`);
  if (!klass?.level_id || klass.type !== 'WEEKLY') return;

  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments').select('coder_id').eq('class_id', classId).eq('status', 'ACTIVE');
  if (enrollmentError) throw new Error(`Failed to load enrollments: ${enrollmentError.message}`);

  // The SQL function owns the final eligibility check and performs progression
  // and enrollment updates atomically. It ignores unverified historic progress.
  const { finalizeCoderLevel } = await import('@/lib/dao/levelProgressionsDao');
  for (const enrollment of enrollments ?? []) {
    const result = await finalizeCoderLevel({
      coderId: enrollment.coder_id,
      sourceLevelId: klass.level_id,
      sourceClassId: classId,
    });
    if (!result?.createdNow) continue;
    const message = result.status === 'PROGRAM_COMPLETED'
      ? 'Seluruh level program telah selesai.'
      : 'Level selesai. Kamu sedang menunggu penempatan kelas berikutnya.';
    await Promise.all([
      createNotification(enrollment.coder_id, 'Kenaikan level', message, 'LEVEL_PROGRESSION'),
      createAdminNotifications({
        title: 'Coder menunggu penempatan level',
        message: `Coder ${enrollment.coder_id} telah menyelesaikan level dan menunggu penempatan.`,
        type: 'LEVEL_PROGRESSION',
        pushUrl: '/admin/level-progressions',
        pushTag: `level-complete:${result.progressionId}`,
      }),
    ]);
  }
}

function computeJourneyOrder(blocks: BlockRecord[]): string[] {
  return blocks
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((block) => block.id);
}

export type CoderJourneyRecord = {
  block_id: string;
  journey_order: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  deferred_after_class: boolean;
  entry_lesson_position: number | null;
};

export async function getCoderJourney(coderId: string, levelId: string): Promise<CoderJourneyRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('coder_block_progress')
    .select('block_id, journey_order, status, deferred_after_class, entry_lesson_position')
    .eq('coder_id', coderId)
    .eq('level_id', levelId)
    .order('journey_order', { ascending: true });

  if (error) {
    console.error(`Failed to fetch coder journey: ${error.message}`);
    return [];
  }
  return data ?? [];
}

export async function getCoderJourneyAcrossLevels(coderId: string): Promise<CoderJourneyProgressRow[]> {
  const supabase = getSupabaseAdmin();
  const { data: progress, error: progressError } = await supabase
    .from('coder_block_progress')
    .select('level_id, block_id, journey_order, status')
    .eq('coder_id', coderId)
    .order('journey_order', { ascending: true });

  if (progressError) {
    console.error(`Failed to fetch coder journey across levels: ${progressError.message}`);
    return [];
  }
  if (!progress?.length) return [];

  const levelIds = [...new Set(progress.map((row) => row.level_id))];
  const blockIds = [...new Set(progress.map((row) => row.block_id))];
  const [{ data: levels, error: levelsError }, { data: blocks, error: blocksError }] = await Promise.all([
    supabase.from('levels').select('id, name, order_index').in('id', levelIds),
    supabase.from('blocks').select('id, name').in('id', blockIds),
  ]);

  if (levelsError || blocksError) {
    console.error(`Failed to resolve coder journey labels: ${levelsError?.message || blocksError?.message}`);
    return [];
  }

  const levelById = new Map((levels ?? []).map((level) => [level.id, level]));
  const blockById = new Map((blocks ?? []).map((block) => [block.id, block]));
  return progress.flatMap((row) => {
    const level = levelById.get(row.level_id);
    const block = blockById.get(row.block_id);
    if (!level || !block) return [];
    return [{
      levelId: level.id,
      levelName: level.name,
      levelOrder: level.order_index,
      blockId: block.id,
      blockName: block.name,
      journeyOrder: row.journey_order,
      status: row.status,
    }];
  });
}

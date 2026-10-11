import { getSupabaseAdmin } from '@/lib/supabaseServer';
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
    const knownBlockIds = new Set(existing.map((row) => row.block_id));
    const missingBlockIds = computeJourneyOrder(blocks).filter((blockId) => !knownBlockIds.has(blockId));

    if (missingBlockIds.length === 0) {
      return;
    }

    const lastJourneyOrder = existing.reduce((max, row) => Math.max(max, row.journey_order), -1);
    const payload = missingBlockIds.map((blockId, index) => ({
      coder_id: coderId,
      level_id: levelId,
      block_id: blockId,
      journey_order: lastJourneyOrder + index + 1,
      status: 'PENDING' as const,
    }));

    const insertResult = await supabase.from('coder_block_progress').insert(payload);
    if (insertResult.error) {
      throw new Error(`Failed to extend coder block journey: ${insertResult.error.message}`);
    }
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
};

export async function getCoderJourney(coderId: string, levelId: string): Promise<CoderJourneyRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('coder_block_progress')
    .select('block_id, journey_order, status')
    .eq('coder_id', coderId)
    .eq('level_id', levelId)
    .order('journey_order', { ascending: true });

  if (error) {
    console.error(`Failed to fetch coder journey: ${error.message}`);
    return [];
  }
  return data ?? [];
}

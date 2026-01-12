import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { BlockRecord } from '@/lib/dao/blocksDao';

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

  const orderedBlockIds = computeJourneyOrder(blocks);
  const entryIndex = entryBlockId ? orderedBlockIds.indexOf(entryBlockId) : 0;
  const startIndex = entryIndex >= 0 ? entryIndex : 0;

  // Calculate intended order
  const wrappedBlockIds = [
    ...orderedBlockIds.slice(startIndex),
    ...orderedBlockIds.slice(0, startIndex),
  ];

  // Self-Correction Logic:
  // If progress exists but order START is different from requested entryBlockId, we re-shuffle
  if (existing && existing.length > 0) {
    if (!entryBlockId) return; // No specific request, keep existing

    const currentStartBlockId = existing[0].block_id;
    if (currentStartBlockId === entryBlockId) {
      return; // Already correct
    }

    console.log(`[Journey] Detected order mismatch for coder ${coderId}. Resetting order to start from ${entryBlockId}.`);

    // Force Reset: Delete all and re-create to ensure clean state
    await supabase
      .from('coder_block_progress')
      .delete()
      .eq('coder_id', coderId)
      .eq('level_id', levelId);
  }

  // If we just deleted, existing is now "considered empty" effectively for our purpose
  // We just proceed to insert the fresh wrappedBlockIds payload.

  // Note: If we didn't delete (existing mismatch), we continue to insert.
  // But wait! If existing was correct, we returned above.
  // If existing was incorrect, we deleted it.
  // What if existing matched but incomplete? Or something else?
  // Our logic above: if existing > 0 and correct -> return.
  // if existing > 0 and incorrect -> delete -> now we need to insert.

  // So we just need to proceed to insert payload normally here.

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

export async function markBlockCompletedForClass(classId: string, blockId: string | null): Promise<void> {
  if (!blockId) {
    return;
  }
  const supabase = getSupabaseAdmin();

  const classQuery = await supabase.from('classes').select('level_id').eq('id', classId).maybeSingle();
  if (classQuery.error) {
    throw new Error(`Failed to fetch class for progress update: ${classQuery.error.message}`);
  }
  const levelId = classQuery.data?.level_id;
  if (!levelId) {
    return;
  }

  const enrollmentQuery = await supabase
    .from('enrollments')
    .select('coder_id')
    .eq('class_id', classId)
    .eq('status', 'ACTIVE');

  if (enrollmentQuery.error) {
    throw new Error(`Failed to list class enrollments: ${enrollmentQuery.error.message}`);
  }

  const coderIds = (enrollmentQuery.data ?? []).map((row) => row.coder_id);
  if (coderIds.length === 0) {
    return;
  }

  const nowIso = new Date().toISOString();
  const progressUpdate = await supabase
    .from('coder_block_progress')
    .update({ status: 'COMPLETED', completed_at: nowIso })
    .in('coder_id', coderIds)
    .eq('block_id', blockId)
    .neq('status', 'COMPLETED');

  if (progressUpdate.error) {
    throw new Error(`Failed to mark block completed: ${progressUpdate.error.message}`);
  }

  const progressQuery = await supabase
    .from('coder_block_progress')
    .select('id, coder_id, level_id, block_id, status, journey_order')
    .in('coder_id', coderIds)
    .eq('level_id', levelId)
    .order('journey_order', { ascending: true });

  if (progressQuery.error) {
    throw new Error(`Failed to load coder progress rows: ${progressQuery.error.message}`);
  }

  const rows = progressQuery.data ?? [];
  const activateIds: string[] = [];
  const resetIds: string[] = [];
  const completedCoderIds: string[] = [];

  groupBy(rows, (row) => row.coder_id).forEach((entries, coderId) => {
    const unfinished = entries.filter((entry) => entry.status !== 'COMPLETED');
    if (unfinished.length === 0) {
      completedCoderIds.push(coderId);
      return;
    }

    const currentOrder =
      entries.find((entry) => entry.block_id === blockId)?.journey_order ?? -1;

    const forward = unfinished.filter((entry) => entry.journey_order > currentOrder);
    const nextRow = (forward.length > 0 ? forward : unfinished).sort(
      (a, b) => a.journey_order - b.journey_order,
    )[0];

    const staleInProgress = entries
      .filter((entry) => entry.status === 'IN_PROGRESS' && entry.id !== nextRow.id)
      .map((entry) => entry.id);
    resetIds.push(...staleInProgress);
    if (nextRow.status !== 'IN_PROGRESS') {
      activateIds.push(nextRow.id);
    }
  });

  if (resetIds.length > 0) {
    const resetResult = await supabase.from('coder_block_progress').update({ status: 'PENDING' }).in('id', resetIds);
    if (resetResult.error) {
      throw new Error(`Failed to reset stale progress rows: ${resetResult.error.message}`);
    }
  }

  if (activateIds.length > 0) {
    const activateResult = await supabase.from('coder_block_progress').update({ status: 'IN_PROGRESS' }).in('id', activateIds);
    if (activateResult.error) {
      throw new Error(`Failed to activate next block: ${activateResult.error.message}`);
    }
  }

  if (completedCoderIds.length > 0) {
    const enrollmentUpdate = await supabase
      .from('enrollments')
      .update({ status: 'INACTIVE' })
      .eq('class_id', classId)
      .in('coder_id', completedCoderIds);
    if (enrollmentUpdate.error) {
      throw new Error(`Failed to deactivate completed enrollments: ${enrollmentUpdate.error.message}`);
    }
  }
}

function computeJourneyOrder(blocks: BlockRecord[]): string[] {
  return blocks
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((block) => block.id);
}

function groupBy<T, K>(items: T[], getKey: (item: T) => K): Map<K, T[]> {
  return items.reduce((map, item) => {
    const key = getKey(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
    return map;
  }, new Map<K, T[]>());
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

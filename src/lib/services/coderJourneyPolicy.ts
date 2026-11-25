import { nextPersonalBlock, type PersonalBlock } from './personalBlockQueue';

export type PersonalJourneyStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type JourneyDisplayStatus = 'UPCOMING' | 'CURRENT' | 'COMPLETED';

type JourneyBlock = { block_id: string; status: string; start_date: string };

type ScheduledJourneyBlock = Pick<JourneyBlock, 'block_id' | 'status'> & {
  runtimeStatus: JourneyDisplayStatus;
  firstSessionAt: string | null;
  lastSessionAt: string | null;
};

// Class participation can continue while individual assessment is still pending.
export function resolveScheduledContinuations<T extends ScheduledJourneyBlock>(
  blocks: T[],
  journey: PersonalBlock[],
): T[] {
  const personal = nextPersonalBlock(journey);
  if (personal?.status !== 'IN_PROGRESS' || personal.deferred_after_class) return [];

  const personalInstances = blocks.filter((block) => block.block_id === personal.block_id);
  if (!personalInstances.length || personalInstances.some((block) =>
    block.status !== 'COMPLETED' || block.runtimeStatus !== 'COMPLETED' || !block.lastSessionAt,
  )) return [];

  const remaining = journey
    .filter((row) => row.journey_order > personal.journey_order && row.status !== 'COMPLETED')
    .sort((a, b) => a.journey_order - b.journey_order);

  const continuations: T[] = [];
  let lastSession = Math.max(...personalInstances.map((block) => Date.parse(block.lastSessionAt ?? '')));
  for (const next of remaining) {
    if (next.status !== 'PENDING' || next.deferred_after_class) break;
    const candidate = blocks.find((block) =>
      block.block_id === next.block_id &&
      (block.status === 'CURRENT' || block.status === 'COMPLETED') &&
      block.status === block.runtimeStatus &&
      Date.parse(block.firstSessionAt ?? '') > lastSession &&
      Date.parse(block.lastSessionAt ?? '') >= Date.parse(block.firstSessionAt ?? ''),
    );
    if (!candidate) break;
    continuations.push(candidate);
    if (candidate.runtimeStatus === 'CURRENT') break;
    lastSession = Date.parse(candidate.lastSessionAt ?? '');
  }
  return continuations;
}

export function mergeJourneyStatus(
  runtimeStatus: JourneyDisplayStatus,
  personalStatus?: PersonalJourneyStatus,
): JourneyDisplayStatus {
  if (!personalStatus) return runtimeStatus;
  if (personalStatus === 'COMPLETED') return 'COMPLETED';
  if (personalStatus === 'IN_PROGRESS') return 'CURRENT';
  return 'UPCOMING';
}

export function buildDisplayedJourneyBlocks<T extends JourneyBlock>(
  curriculumBlocks: T[],
  journeyOrderedBlocks: T[],
): T[] {
  // A curriculum block can recur in later class cycles. Keep one personal
  // journey item and prefer the live class instance to its historical copy.
  const chosen = new Map<string, T>();
  for (const block of journeyOrderedBlocks.length ? journeyOrderedBlocks : curriculumBlocks) {
    if (!block.block_id) continue;
    const previous = chosen.get(block.block_id);
    const priority = (status: string) => status === 'CURRENT' ? 3 : status === 'UPCOMING' ? 2 : 1;
    if (!previous || priority(block.status) > priority(previous.status) ||
      (priority(block.status) === priority(previous.status) && block.start_date > previous.start_date)) {
      chosen.set(block.block_id, block);
    }
  }
  const order = new Map<string, number>();
  journeyOrderedBlocks.forEach((block, index) => {
    if (!order.has(block.block_id)) order.set(block.block_id, index);
  });
  return [...chosen.values()].sort((a, b) => (order.get(a.block_id) ?? 0) - (order.get(b.block_id) ?? 0));
}

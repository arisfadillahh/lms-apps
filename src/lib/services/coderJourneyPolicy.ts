export type PersonalJourneyStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type JourneyDisplayStatus = 'UPCOMING' | 'CURRENT' | 'COMPLETED';

type JourneyBlock = { block_id: string; status: string; start_date: string };

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

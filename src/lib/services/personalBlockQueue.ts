export type PersonalBlock = {
  block_id: string;
  journey_order: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  deferred_after_class?: boolean;
};

export function nextPersonalBlock<T extends PersonalBlock>(journey: T[]): T | null {
  const ordered = [...journey].sort((a, b) => a.journey_order - b.journey_order);
  return ordered.find((row) => row.status === 'IN_PROGRESS')
    ?? ordered.find((row) => row.status === 'PENDING')
    ?? null;
}

export function isDeferredBlockOpen(row: PersonalBlock | undefined): boolean {
  return row?.status === 'IN_PROGRESS' && row.deferred_after_class === true;
}

export function planTransferQueue<T extends PersonalBlock>(journey: T[], targetBlockId: string, curriculumOrder: string[]) {
  const targetIndex = curriculumOrder.indexOf(targetBlockId);
  if (targetIndex < 0) throw new Error('Target block is outside the coder level');
  const previous = new Map(journey.map((row) => [row.block_id, row]));
  const sourceBlockId = journey.find((row) => row.status === 'IN_PROGRESS')?.block_id;
  const deferredSourceId = sourceBlockId !== targetBlockId ? sourceBlockId : undefined;
  const completed = [...journey].filter((row) => row.status === 'COMPLETED')
    .sort((a, b) => a.journey_order - b.journey_order);
  const remainingIds = [...curriculumOrder.slice(targetIndex), ...curriculumOrder.slice(0, targetIndex)]
    .filter((id) => previous.get(id)?.status !== 'COMPLETED');
  const orderedRemainingIds = [...remainingIds.filter((id) => id !== deferredSourceId),
    ...remainingIds.filter((id) => id === deferredSourceId)];
  return [...completed.map((row) => row.block_id), ...orderedRemainingIds].map((id, index) => {
    const row = previous.get(id);
    const sourceIndex = curriculumOrder.indexOf(id);
    return {
      block_id: id,
      journey_order: index,
      status: row?.status === 'COMPLETED' ? 'COMPLETED' as const
        : id === orderedRemainingIds[0] ? 'IN_PROGRESS' as const : 'PENDING' as const,
      deferred_after_class: row?.status === 'COMPLETED' ? false
        : sourceIndex < targetIndex || id === deferredSourceId,
    };
  });
}

export type CoderJourneyProgressRow = {
  levelId: string;
  levelName: string;
  levelOrder: number;
  blockId: string;
  blockName: string;
  journeyOrder: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
};

export type CoderLevelJourney = {
  levelId: string;
  levelName: string;
  levelOrder: number;
  blocks: CoderJourneyProgressRow[];
};

export function groupCoderJourneyByLevel(rows: CoderJourneyProgressRow[]): CoderLevelJourney[] {
  const sorted = [...rows].sort((left, right) =>
    left.levelOrder - right.levelOrder ||
    left.levelId.localeCompare(right.levelId) ||
    left.journeyOrder - right.journeyOrder,
  );

  return sorted.reduce<CoderLevelJourney[]>((levels, row) => {
    let level = levels.at(-1);
    if (!level || level.levelId !== row.levelId) {
      level = { levelId: row.levelId, levelName: row.levelName, levelOrder: row.levelOrder, blocks: [] };
      levels.push(level);
    }
    level.blocks.push(row);
    return levels;
  }, []);
}

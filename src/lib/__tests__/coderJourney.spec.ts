import { describe, expect, it } from 'vitest';
import { groupCoderJourneyByLevel, type CoderJourneyProgressRow } from '@/lib/coderJourney';

const row = (overrides: Partial<CoderJourneyProgressRow>): CoderJourneyProgressRow => ({
  levelId: 'level-a',
  levelName: 'Creative Tech Explorers',
  levelOrder: 0,
  blockId: 'block-1',
  blockName: 'Block 1',
  journeyOrder: 0,
  status: 'COMPLETED',
  ...overrides,
});

describe('coder level journey grouping', () => {
  it('keeps every level and orders each level by its personalized journey order', () => {
    const levels = groupCoderJourneyByLevel([
      row({ levelId: 'level-b', levelName: 'Coding & Creativity', levelOrder: 1, blockId: 'block-b2', blockName: 'Block 2', journeyOrder: 1, status: 'IN_PROGRESS' }),
      row({ blockId: 'block-2', blockName: 'Block 2', journeyOrder: 1 }),
      row({ levelId: 'level-b', levelName: 'Coding & Creativity', levelOrder: 1, blockId: 'block-b1', blockName: 'Block 1', journeyOrder: 0 }),
      row({ blockId: 'block-1' }),
    ]);

    expect(levels.map((level) => level.levelName)).toEqual(['Creative Tech Explorers', 'Coding & Creativity']);
    expect(levels[0].blocks.map((block) => block.blockId)).toEqual(['block-1', 'block-2']);
    expect(levels[1].blocks.map((block) => block.blockId)).toEqual(['block-b1', 'block-b2']);
    expect(levels[1].blocks[1].status).toBe('IN_PROGRESS');
  });

  it('returns an empty journey when no progress exists', () => {
    expect(groupCoderJourneyByLevel([])).toEqual([]);
  });
});

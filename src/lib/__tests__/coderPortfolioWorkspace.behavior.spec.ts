import { describe, expect, it } from 'vitest';

import { buildCoderPortfolioClasses } from '@/lib/coderPortfolio';

describe('coder portfolio workspace class mapping', () => {
  it('returns a stable empty workspace for a Coder without enrollment', () => {
    expect(buildCoderPortfolioClasses([], [])).toEqual([]);
  });

  it('uses block metadata for deterministic order instead of a class_blocks order column', () => {
    const classes = buildCoderPortfolioClasses(
      [{ class_id: 'weekly-1', classes: { id: 'weekly-1', name: 'Weekly Explorer', type: 'WEEKLY', levels: { name: 'Explorer' } } }],
      [
        { class_id: 'weekly-1', block_id: 'block-2', blocks: { id: 'block-2', name: 'Game', order_index: 2 } },
        { class_id: 'weekly-1', block_id: 'block-1', blocks: { id: 'block-1', name: 'Animation', order_index: 1 } },
      ],
    );

    expect(classes).toEqual([
      {
        id: 'weekly-1',
        name: 'Weekly Explorer',
        type: 'WEEKLY',
        levelName: 'Explorer',
        blocks: [
          { id: 'block-1', name: 'Animation' },
          { id: 'block-2', name: 'Game' },
        ],
      },
    ]);
  });

  it('supports Weekly and Ekskul history while ignoring duplicate, missing, or unsupported relations', () => {
    const classes = buildCoderPortfolioClasses(
      [
        { class_id: 'weekly-1', classes: [{ id: 'weekly-1', name: 'Weekly', type: 'WEEKLY', levels: [{ name: 'Creator' }] }] },
        { class_id: 'weekly-1', classes: { id: 'weekly-1', name: 'Weekly duplicate', type: 'WEEKLY' } },
        { class_id: 'missing', classes: null },
        { class_id: 'trial-1', classes: { id: 'trial-1', name: 'Trial', type: 'TRIAL' } },
        { class_id: 'ekskul-1', classes: { id: 'ekskul-1', name: 'Ekskul', type: 'EKSKUL', levels: null } },
      ],
      [
        { class_id: 'weekly-1', block_id: 'block-1', blocks: [{ id: 'block-1', name: 'Weekly Block', order_index: 1 }] },
        { class_id: 'ekskul-1', block_id: 'block-2', blocks: { id: 'block-2', name: 'Ekskul Block', order_index: 1 } },
        { class_id: 'ekskul-1', block_id: 'missing-block', blocks: null },
      ],
    );

    expect(classes.map((item) => ({ id: item.id, type: item.type, levelName: item.levelName, blocks: item.blocks }))).toEqual([
      { id: 'weekly-1', type: 'WEEKLY', levelName: 'Creator', blocks: [{ id: 'block-1', name: 'Weekly Block' }] },
      { id: 'ekskul-1', type: 'EKSKUL', levelName: undefined, blocks: [{ id: 'block-2', name: 'Ekskul Block' }] },
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { getDropdownPosition } from '@/components/admin/ActionDropdown';

describe('admin action dropdown positioning', () => {
  it('opens above a bottom-row trigger instead of being clipped below the table', () => {
    const position = getDropdownPosition(
      { top: 760, bottom: 800, left: 740, right: 780 },
      { width: 800, height: 844 },
      { width: 200, height: 240 },
    );

    expect(position.top).toBe(516);
    expect(position.left).toBe(580);
    expect(position.maxHeight).toBe(756);
  });

  it('keeps a menu reachable and inside the viewport on a narrow screen', () => {
    const position = getDropdownPosition(
      { top: 60, bottom: 100, left: 4, right: 44 },
      { width: 320, height: 568 },
      { width: 200, height: 240 },
    );

    expect(position.top).toBe(104);
    expect(position.left).toBe(4);
    expect(position.maxHeight).toBe(464);
  });
});

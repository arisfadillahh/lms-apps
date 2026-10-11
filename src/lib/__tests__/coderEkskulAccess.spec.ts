import { describe, expect, it } from 'vitest';

import { isEkskulLessonAccessible } from '@/lib/services/coderLessonAccess';

describe('Ekskul coder lesson access', () => {
  it('opens only lessons whose matching sessions are completed', () => {
    expect(isEkskulLessonAccessible(0, 0)).toBe(false);
    expect(isEkskulLessonAccessible(0, 1)).toBe(true);
    expect(isEkskulLessonAccessible(1, 1)).toBe(false);
    expect(isEkskulLessonAccessible(1, 2)).toBe(true);
  });

  it('does not grant access for invalid lesson indexes', () => {
    expect(isEkskulLessonAccessible(-1, 3)).toBe(false);
    expect(isEkskulLessonAccessible(0, -1)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { resolveLessonPartNumber } from '@/lib/services/lessonPartNumber';
import { resolveCoachExampleUrl } from '@/lib/services/coachLessonContent';

describe('lesson schedule part numbers', () => {
  it('uses the final part marker for an extended lesson title', () => {
    expect(resolveLessonPartNumber('Enterpreneurship (Part 4) (Part 5)', 5, 4)).toBe(5);
  });

  it('keeps ordinary titles and marker-less grouped lessons stable', () => {
    expect(resolveLessonPartNumber('Full CRUD Firebase (Part 1)', 4, 0)).toBe(1);
    expect(resolveLessonPartNumber('Lesson tanpa marker', 3, 2)).toBe(3);
    expect(resolveLessonPartNumber(null, 1, 0)).toBe(1);
  });

  it('prefers a Weekly class snapshot and falls back to the template URL', () => {
    expect(resolveCoachExampleUrl(' https://example.com/class-game ', 'https://example.com/template-game')).toBe('https://example.com/class-game');
    expect(resolveCoachExampleUrl(null, ' https://example.com/template-game ')).toBe('https://example.com/template-game');
    expect(resolveCoachExampleUrl('  ', null)).toBeNull();
  });
});

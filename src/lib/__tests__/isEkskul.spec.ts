import { describe, expect, it } from 'vitest';
import { isEkskulClass } from '@/lib/isEkskul';

describe('isEkskulClass', () => {
  it('recognizes the authoritative EKSKUL class type', () => {
    expect(isEkskulClass({ type: 'EKSKUL' })).toBe(true);
    expect(isEkskulClass({ type: 'WEEKLY' })).toBe(false);
    expect(isEkskulClass({ type: null })).toBe(false);
    expect(isEkskulClass(null)).toBe(false);
    expect(isEkskulClass('EKSKUL')).toBe(false);
  });
});

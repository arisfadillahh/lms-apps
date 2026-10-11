import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Coach attendance mobile actions', () => {
  it('keeps the attendance actions above the fixed mobile navigation', () => {
    const wrapper = readFileSync(
      resolve(process.cwd(), 'src/app/(coach)/coach/sessions/[sessionId]/attendance/AttendanceWrapper.tsx'),
      'utf8',
    );
    const styles = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

    expect(wrapper).toContain('coach-attendance-action-strip');
    expect(wrapper).toContain('className="h-24 md:hidden"');
    expect(styles).toContain('.coach-attendance-action-strip');
    expect(styles).toContain('bottom: calc(70px + env(safe-area-inset-bottom));');
  });
});

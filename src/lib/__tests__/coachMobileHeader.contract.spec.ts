import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Coach mobile header layout contract', () => {
  it('keeps the greeting flexible while reserving reachable action controls', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/components/coach/CoachDashboardHeader.tsx'),
      'utf8',
    );
    const layout = fs.readFileSync(
      path.join(root, 'src/app/(coach)/coach/layout.tsx'),
      'utf8',
    );

    expect(source).toContain('max-md:px-4');
    expect(source).toContain('min-w-0 flex-1 items-center');
    expect(source).toContain('min-w-0 flex-1 truncate whitespace-nowrap');
    expect(source).toContain('flex shrink-0 items-center justify-end');
    expect(source).toContain('hidden h-4 w-4');
    expect(source).toContain('w-full min-w-0 max-w-full');
    expect(layout).toContain('min-w-0 flex-1 flex flex-col');
    expect(layout).toContain('px-4 md:px-8');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Coder mobile navigation visibility contract', () => {
  it('keeps the bottom navigation hidden outside the phone breakpoint', () => {
    const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
    const nav = fs.readFileSync(
      path.join(root, 'src/app/(coder)/coder/CoderSidebar.tsx'),
      'utf8',
    );

    expect(css).toContain('.coder-mobile-nav {');
    expect(css).toContain('display: none;');
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('display: grid;');
    expect(nav).toContain('className="coder-mobile-nav md:hidden"');
  });
});

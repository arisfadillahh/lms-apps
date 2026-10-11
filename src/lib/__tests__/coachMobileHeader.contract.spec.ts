import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Coach mobile header layout contract', () => {
  it('keeps the top bar full-width and moves all five destinations into the bottom navigation', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/components/coach/CoachDashboardHeader.tsx'),
      'utf8',
    );
    const layout = fs.readFileSync(
      path.join(root, 'src/app/(coach)/coach/layout.tsx'),
      'utf8',
    );
    const mobileNav = fs.readFileSync(
      path.join(root, 'src/app/(coach)/coach/CoachMobileNav.tsx'),
      'utf8',
    );
    const portfolio = fs.readFileSync(
      path.join(root, 'src/app/(coach)/coach/portfolios/page.tsx'),
      'utf8',
    );
    const styles = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');

    expect(source).toContain('w-full min-w-0 max-w-full');
    expect(source).toContain('coach-dashboard-header');
    expect(source).toContain('px-4 py-3');
    expect(source).toContain('min-w-0 flex-1 items-center');
    expect(source).toContain('min-w-0 flex-1 truncate whitespace-nowrap');
    expect(source).toContain('flex shrink-0 items-center justify-end');
    expect(source).toContain('hidden h-4 w-4');
    expect(source).not.toContain('<MobileNav');
    expect(layout).toContain('min-w-0 flex-1 flex flex-col');
    expect(layout).toContain('flex-1 px-4 pb-24 md:px-8 md:pb-8');
    expect(layout).toContain('<CoachMobileNav />');
    expect(layout).not.toContain('flex-grow px-4 md:px-8');
    expect(mobileNav.match(/href: '\/coach\//g)).toHaveLength(5);
    expect(mobileNav).toContain("href: '/coach/portfolios'");
    expect(mobileNav).toContain('coach-mobile-nav-item');
    expect(styles).toContain('grid-template-columns: repeat(5, minmax(0, 1fr));');
    expect(styles).toMatch(/\.coach-main\s*\{[\s\S]*?padding-left: 0 !important;/);
    expect(styles).toMatch(/\.coach-dashboard-header\s*\{[\s\S]*?width: 100vw !important;/);
    expect(portfolio).toContain('coach-portfolio-page -mx-4');
    expect(portfolio).toContain('md:-mx-8');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('public portfolio universe responsive shell', () => {
  const experience = read('src/components/portfolio/PublicPortfolioExperience.tsx');
  const gallery = read('src/components/portfolio/PublicPortfolioGallery.tsx');
  const motion = read('src/components/portfolio/PublicPortfolioExperience.module.css');
  const scrollLock = read('src/lib/documentScrollLock.ts');
  const mobileScrollFix = read('src/components/layout/MobileScrollFix.tsx');

  it('locks the document while the full-screen intro is visible', () => {
    expect(experience).toContain('lockDocumentScroll()');
    expect(scrollLock).toContain("setProperty('overflow-y', 'hidden', 'important')");
    expect(scrollLock).toContain("setProperty('overscroll-behavior', 'none', 'important')");
    expect(experience).toContain('fixed inset-0');
    expect(experience).toContain('<section className={`${styles.introGate}');
    expect(experience).not.toContain('role="dialog" aria-modal="true"');
    expect(experience).not.toContain('grid h-[100dvh] w-full max-w-full');
    expect(experience).toContain('overflow-x-clip');
    expect(experience).toContain('classList.add(styles.introLocked)');
    expect(motion).toContain('scrollbar-width: none');
    expect(motion).toContain('max-width: none');
    expect(motion).toContain('max-height: none');
    expect(motion).toContain('width: 100%');
    expect(motion).toContain('height: 100dvh');
  });

  it('keeps orbit geometry inside narrow viewports', () => {
    expect(experience).not.toContain('size-[min(640px,100vw)]');
    expect(experience).toContain('size-[min(640px,calc(100vw-1.5rem))]');
    expect(experience).toContain('text-[clamp(2.75rem,13.5vw,6.6rem)]');
  });

  it('provides universe motion with a reduced-motion fallback', () => {
    expect(motion).toContain('@keyframes orbitClockwise');
    expect(motion).toContain('@keyframes starTwinkle');
    expect(motion).toContain('@keyframes cometDrift');
    expect(motion).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('adapts the reference background and motion without replacing the existing layout or palette', () => {
    expect(experience).toContain('IntersectionObserver');
    expect(experience).toContain("root.style.setProperty('--portfolio-pointer-x'");
    expect(experience).toContain('data-portfolio-reveal');
    expect(experience).toContain('lg:grid-cols-[.98fr_1.02fr]');
    expect(experience).toContain('lg:grid-cols-[1.03fr_.97fr]');
    expect(experience).toContain('lg:grid-cols-[.96fr_1.04fr]');
    expect(experience).toContain('linear-gradient(180deg,#172761_0%,#111d4d_42%,#0e1740_100%)');
    expect(gallery).toContain('md:grid-cols-12');
    expect(gallery).toContain('onPointerMove={handlePointerMove}');
    expect(motion).toContain("type='fractalNoise'");
    expect(motion).toContain('.cursorGlow');
    expect(motion).toContain('@keyframes ambientDrift');
    expect(motion).toContain('.portalParallax');
    expect(motion).toContain('.projectTilt');
    expect(motion).toContain('.sheenButton::after');
  });

  it('keeps project details reachable as a mobile bottom sheet', () => {
    expect(gallery).toContain('items-end overflow-hidden');
    expect(gallery).toContain('bg-[#050a22]/85 p-0');
    expect(gallery).toContain('!max-h-[100dvh]');
    expect(gallery).toContain('overflow-x-hidden overflow-y-auto');
    expect(gallery).toContain('sm:place-items-center');
    expect(gallery).toContain('h-[100dvh] w-screen');
    expect(gallery).toContain('!max-w-none');
    expect(gallery).toContain('!w-screen');
    expect(gallery).toContain('lockDocumentScroll()');
    expect(gallery).toContain('unlockDocumentScroll()');
    expect(scrollLock).toContain("getPropertyPriority(property)");
    expect(scrollLock).toContain("restoreProperty(html, property");
    expect(scrollLock).toContain("classList.add(DOCUMENT_SCROLL_LOCK_CLASS)");
    expect(mobileScrollFix).toContain("classList.contains(DOCUMENT_SCROLL_LOCK_CLASS)");
    expect(mobileScrollFix).toContain("scrollLocked ? 'hidden' : 'scroll'");
  });
});

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
    expect(experience).toContain('text-[clamp(2.5rem,12vw,5.6rem)]');
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
    expect(gallery).toContain('sm:grid-cols-2 lg:grid-cols-3');
    expect(gallery).toContain('aspect-[3/2] min-h-[18rem]');
    expect(gallery).toContain('onPointerMove={handlePointerMove}');
    expect(motion).toContain("type='fractalNoise'");
    expect(motion).toContain('.cursorGlow');
    expect(motion).toContain('@keyframes ambientDrift');
    expect(motion).toContain('.portalParallax');
    expect(motion).toContain('.projectTilt');
    expect(motion).toContain('.sheenButton::after');
    expect(motion).toContain('.greenGlow');
    expect(motion).toContain('@media (max-width: 400px) and (max-height: 560px)');
    expect(motion).toContain('@media (min-width: 640px) and (max-width: 1023px) and (min-height: 701px)');
    expect(motion).toContain('.root :global(h1)');
    expect(motion).toContain('.root :global(h2)');
    expect(motion).toContain('.root :global(h3)');
    expect(experience).not.toContain('shadow-[0_14px_34px_rgba(157,200,59,.2)]');
    expect(experience).toContain('dataset.portfolioPage');
    expect(mobileScrollFix).toContain('body:not([data-portfolio-page="true"])');
    expect(mobileScrollFix).toContain("portfolio-scroll-mode-change");
    expect(motion).toContain('html[data-portfolio-page="true"]');
    expect(motion).toContain('body[data-portfolio-page="true"]');
    expect(motion).toContain('overflow: visible !important');
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
    expect(gallery).toContain('aspect-[4/3] overflow-hidden rounded-2xl');
    expect(gallery).toContain('lockDocumentScroll()');
    expect(gallery).toContain('unlockDocumentScroll()');
    expect(scrollLock).toContain("getPropertyPriority(property)");
    expect(scrollLock).toContain("restoreProperty(html, property");
    expect(scrollLock).toContain("classList.add(DOCUMENT_SCROLL_LOCK_CLASS)");
    expect(mobileScrollFix).toContain("classList.contains(DOCUMENT_SCROLL_LOCK_CLASS)");
    expect(mobileScrollFix).toContain("scrollLocked ? 'hidden' : 'scroll'");
  });
});

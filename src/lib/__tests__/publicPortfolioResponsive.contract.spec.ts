import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('public portfolio mockup-v4 responsive contract', () => {
  const experience = read('src/components/portfolio/PublicPortfolioExperience.tsx');
  const gallery = read('src/components/portfolio/PublicPortfolioGallery.tsx');
  const css = read('src/components/portfolio/PublicPortfolioExperience.module.css');
  const scrollLock = read('src/lib/documentScrollLock.ts');

  it('uses the v4 page hierarchy and the official Clevio logo', () => {
    expect(experience).toContain('/images/clevio-logo.png.png');
    expect(experience).toContain("A Young Creator&apos;s Journey");
    expect(gallery).toContain('Featured Project');
    expect(experience).toContain('My Learning Journey');
    expect(experience).toContain('Skills I&apos;m Building');
    expect(experience).toContain('<Rocket size={54} />');
    expect(experience).toContain('document.body.dataset.portfolioPage');
  });

  it('keeps the light reference palette and responsive page structure', () => {
    expect(css).toContain('--navy:#14347f');
    expect(css).toContain('linear-gradient(#f8fbff,#f6f9fe)');
    expect(css).toContain('grid-template-columns:1.02fr .98fr');
    expect(css).toContain('grid-template-columns:repeat(4,1fr) 1.55fr');
    expect(css).toContain('@media(max-width:720px)');
    expect(css).toContain('@media(max-width:520px)');
    expect(css).toContain('overflow-x:clip');
  });

  it('keeps dynamic project content reachable with a filter and an accessible modal', () => {
    expect(gallery).toContain("const featured = projects[0]");
    expect(gallery).toContain("const [filter, setFilter] = useState('All')");
    expect(gallery).toContain('snapshot.screenshots');
    expect(gallery).toContain('role=\"dialog\" aria-modal=\"true\"');
    expect(gallery).toContain('lockDocumentScroll()');
    expect(gallery).toContain('unlockDocumentScroll()');
    expect(gallery).toContain('window.addEventListener');
    expect(css).toContain('.modalShell');
    expect(css).toContain('@media(max-width:700px)');
    expect(scrollLock).toContain("setProperty('overflow-y', 'hidden', 'important')");
  });

  it('uses real block progress rather than reference-only milestones', () => {
    expect(experience).toContain('model.learningJourney.flatMap');
    expect(experience).toContain("block.status === 'COMPLETED'");
    expect(experience).toContain("block.status === 'IN_PROGRESS'");
    expect(experience).toContain('Blocks Completed');
    expect(experience).not.toContain('Khansa');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildPortfolioExperienceModel, type ExperienceProject } from '@/lib/publicPortfolioExperience';

const project = (overrides: Partial<ExperienceProject['snapshot']> = {}): ExperienceProject => ({
  id: crypto.randomUUID(),
  publishedAt: new Date().toISOString(),
  snapshot: {
    title: 'Project Demo',
    projectType: 'Game',
    summary: 'Project game edukasi untuk belajar sambil bermain.',
    description: 'Project ini dibuat untuk menunjukkan proses berpikir dan keputusan desain coder.',
    roleContribution: 'Menyusun alur, tampilan, dan pengujian project.',
    tools: ['Scratch'],
    howToPlay: 'Klik mulai lalu ikuti instruksi di dalam game.',
    playableUrl: 'https://scratch.mit.edu/projects/104/',
    repositoryUrl: null,
    videoUrl: null,
    learningReflection: 'Belajar membuat instruksi yang lebih jelas untuk pemain.',
    nextSteps: 'Menambahkan level dan tantangan baru.',
    skills: ['Game Design', 'Problem Solving'],
    programType: 'WEEKLY',
    screenshots: [],
    ...overrides,
  },
});

describe('public portfolio experience model', () => {
  it('counts spelling variants once per project, without altering approved content', () => {
    const first = project({ skills: ['Game Design', 'game design', '  Game   Design ', 'Game Development'] });
    const second = project({ skills: ['game design'] });
    const model = buildPortfolioExperienceModel({ fullName: 'Test Coder', schoolName: null, schoolVisible: false, levelName: null, programTypes: ['WEEKLY'], projects: [first, second] });
    expect(model.stats.skills).toBe(2);
    expect(model.journey).toEqual([
      { label: 'Game Design', count: 2, percent: 100, detail: 'Dipraktikkan dalam 2 project.' },
      { label: 'Game Development', count: 1, percent: 50, detail: 'Dipraktikkan dalam 1 project.' },
    ]);
    expect(first.snapshot.skills).toEqual(['Game Design', 'game design', '  Game   Design ', 'Game Development']);
  });

  it('orders the journey by publication date and preserves historical program without inventing a level', () => {
    const older = { ...project({ title: 'Older', programType: 'EKSKUL' }), id: 'old', publishedAt: '2026-01-01T00:00:00Z' };
    const newer = { ...project({ title: 'Newer', programType: 'WEEKLY' }), id: 'new', publishedAt: '2026-02-01T00:00:00Z' };
    const unknown = { ...project(), id: 'unknown', publishedAt: 'invalid' };
    const model = buildPortfolioExperienceModel({ fullName: 'Test Coder', schoolName: null, schoolVisible: false, levelName: 'Current level', programTypes: ['WEEKLY', 'EKSKUL'], projects: [newer, unknown, older] });
    expect(model.timeline.map((item) => [item.id, item.program, item.publishedAt])).toEqual([
      ['old', 'Ekskul', '2026-01-01T00:00:00Z'], ['new', 'Weekly', '2026-02-01T00:00:00Z'], ['unknown', 'Weekly', null],
    ]);
    expect(model.projects.map((item) => item.id)).toEqual(['new', 'unknown', 'old']);
    expect(model.timeline[0]).not.toHaveProperty('level');
  });
  it('keeps portfolio fields while deriving data-backed journey stats', () => {
    const model = buildPortfolioExperienceModel({
      fullName: 'Alya Putri',
      schoolName: 'SMA Clevio',
      schoolVisible: true,
      levelName: 'Creator',
      programTypes: ['WEEKLY'],
      projects: [project(), project({ title: 'Project Kedua', skills: ['Problem Solving', 'UI Thinking'] })],
    });

    expect(model.firstName).toBe('Alya');
    expect(model.initials).toBe('AP');
    expect(model.stats).toEqual({ projects: 2, skills: 3, reflections: 2 });
    expect(model.journey[0]).toMatchObject({ label: 'Problem Solving', count: 2, percent: 100 });
    expect(model.latestStory.learningReflection).toContain('Belajar');
    expect(model.traits[0]).toMatchObject({ label: 'Program & level', detail: 'Weekly · Creator' });
    expect(model.traits[1]).toMatchObject({ label: 'Karya yang dibangun', detail: '2 project approved tersimpan di portfolio.' });
    expect(model.traits[2].label).toBe('Skill utama: Problem Solving');
    expect(model.traits[3].label).toBe('Fokus berikutnya');
    expect(model.traits).toHaveLength(4);
  });

  it('renders a safe empty-state model without inventing project metrics', () => {
    const model = buildPortfolioExperienceModel({
      fullName: 'Coder Demo',
      schoolName: null,
      schoolVisible: false,
      levelName: null,
      programTypes: [],
      projects: [],
    });

    expect(model.stats).toEqual({ projects: 0, skills: 0, reflections: 0 });
    expect(model.journey).toEqual([]);
    expect(model.latestStory.nextSteps).toContain('Project berikutnya');
    expect(model.traits[0].detail).toBe('Program belum tercatat · Level belum tercatat');
    expect(model.traits[2].detail).toContain('Skill akan muncul');
  });

  it('uses the newest approved project as featured and keeps the personal level-block order', () => {
    const newest = { ...project({ title: 'Karya Terbaru' }), id: 'newest', publishedAt: '2026-09-10T00:00:00Z' };
    const older = { ...project({ title: 'Karya Lama' }), id: 'older', publishedAt: '2026-08-10T00:00:00Z' };
    const model = buildPortfolioExperienceModel({
      fullName: 'Alya Putri', schoolName: null, schoolVisible: false, levelName: 'Creator', programTypes: ['WEEKLY'], projects: [newest, older],
      learningBlocks: [
        { id: 'block-2', levelName: 'Creator', levelOrder: 2, blockName: 'Block 2', journeyOrder: 1, status: 'IN_PROGRESS', completedAt: null },
        { id: 'block-1', levelName: 'Explorer', levelOrder: 1, blockName: 'Block 1', journeyOrder: 0, status: 'COMPLETED', completedAt: '2026-08-01T00:00:00Z' },
      ],
    });

    expect(model.featuredProject?.id).toBe('newest');
    expect(model.learningJourney.map((level) => level.levelName)).toEqual(['Explorer', 'Creator']);
    expect(model.learningJourney[0]).toMatchObject({ completedCount: 1, blocks: [{ blockName: 'Block 1', status: 'COMPLETED' }] });
  });

  it('keeps public portfolio data on approved snapshots while loading personal block progress', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/portfolio/[slug]/page.tsx'), 'utf8');

    expect(page).toContain(".not('published_snapshot', 'is', null)");
    expect(page).toContain(".from('coder_block_progress')");
    expect(page).toContain("blocks(name, levels(name, order_index))");
    expect(page).not.toContain(".from('coder_portfolios').select('*')");
  });
});

import { describe, expect, it } from 'vitest';

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
});

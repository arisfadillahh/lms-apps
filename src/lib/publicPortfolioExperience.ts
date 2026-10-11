import type { PublishedPortfolioSnapshot } from '@/lib/coderPortfolio';
import { portfolioTagKey, uniquePortfolioTags } from '@/lib/portfolioTags';

export type ExperienceProject = {
  id: string;
  snapshot: PublishedPortfolioSnapshot;
  publishedAt: string | null;
};

export type PortfolioLearningBlock = {
  id: string;
  levelName: string;
  levelOrder: number;
  blockName: string;
  journeyOrder: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt: string | null;
};

export type PortfolioExperienceInput = {
  fullName: string;
  schoolName: string | null;
  schoolVisible: boolean;
  levelName: string | null;
  programTypes: Array<'WEEKLY' | 'EKSKUL'>;
  projects: ExperienceProject[];
  learningBlocks?: PortfolioLearningBlock[];
  season?: string;
};

export type PortfolioExperienceModel = PortfolioExperienceInput & {
  firstName: string;
  initials: string;
  season: string;
  stats: {
    projects: number;
    skills: number;
    reflections: number;
  };
  journey: Array<{
    label: string;
    detail: string;
    count: number;
    percent: number;
  }>;
  latestStory: {
    roleContribution: string;
    learningReflection: string;
    nextSteps: string;
  };
  featuredProject: ExperienceProject | null;
  learningJourney: Array<{
    levelName: string;
    blocks: Array<PortfolioLearningBlock>;
    completedCount: number;
  }>;
  traits: Array<{ label: string; detail: string }>;
  timeline: Array<{ id: string; title: string; publishedAt: string | null; program: string; reflection: string }>;
};

function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}` : parts[0]?.slice(0, 2) ?? 'CO').toUpperCase();
}

export function buildPortfolioExperienceModel(input: PortfolioExperienceInput): PortfolioExperienceModel {
  const projects = input.projects ?? [];
  const learningBlocks = input.learningBlocks ?? [];
  const firstName = input.fullName.trim().split(/\s+/).filter(Boolean)[0] || 'Coder';
  const year = new Date().getFullYear();
  const skillCounts = new Map<string, number>();
  const skillLabels = new Map<string, string>();

  for (const project of projects) {
    for (const skill of uniquePortfolioTags(project.snapshot.skills ?? [])) {
      const key = portfolioTagKey(skill);
      if (!skillLabels.has(key)) skillLabels.set(key, skill);
      skillCounts.set(key, (skillCounts.get(key) ?? 0) + 1);
    }
  }

  const journey = [...skillCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .sort(([, left], [, right]) => right - left)
    .slice(0, 4)
    .map(([label, count]) => ({
      label: skillLabels.get(label)!,
      count,
      percent: projects.length > 0 ? Math.round((count / projects.length) * 100) : 0,
      detail: `Dipraktikkan dalam ${count} project.`,
    }));

  const latest = projects[0]?.snapshot;
  const latestStory = {
    roleContribution: latest?.roleContribution || 'Cerita kontribusi coder akan muncul setelah project disetujui Coach.',
    learningReflection: latest?.learningReflection || 'Refleksi belajar akan menjadi bagian dari perjalanan portfolio.',
    nextSteps: latest?.nextSteps || 'Project berikutnya akan menambahkan bab baru di sini.',
  };

  const programLabel = input.programTypes.length > 0
    ? input.programTypes.map((program) => program === 'WEEKLY' ? 'Weekly' : 'Ekskul').join(' · ')
    : 'Program belum tercatat';
  const levelLabel = input.levelName || 'Level belum tercatat';
  const focusSkill = journey[0]?.label || 'Skill yang dipraktikkan';
  const projectLabel = `${projects.length} project approved tersimpan di portfolio.`;
  const learningJourney = [...learningBlocks]
    .sort((left, right) => left.levelOrder - right.levelOrder || left.journeyOrder - right.journeyOrder || left.id.localeCompare(right.id))
    .reduce<PortfolioExperienceModel['learningJourney']>((groups, block) => {
      const current = groups.at(-1);
      if (!current || current.levelName !== block.levelName) {
        groups.push({ levelName: block.levelName, blocks: [block], completedCount: block.status === 'COMPLETED' ? 1 : 0 });
      } else {
        current.blocks.push(block);
        if (block.status === 'COMPLETED') current.completedCount += 1;
      }
      return groups;
    }, []);

  return {
    ...input,
    firstName,
    initials: initialsFor(input.fullName),
    season: input.season ?? `Learning Journey ${year}`,
    stats: {
      projects: projects.length,
      skills: skillCounts.size,
      reflections: projects.filter((project) => project.snapshot.learningReflection.trim().length > 0).length,
    },
    journey,
    timeline: [...projects].sort((a, b) => {
      const time = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Infinity;
      return time(a.publishedAt) - time(b.publishedAt) || a.id.localeCompare(b.id);
    }).map((project) => ({
      id: project.id,
      title: project.snapshot.title,
      publishedAt: project.publishedAt && Number.isFinite(Date.parse(project.publishedAt)) ? project.publishedAt : null,
      program: project.snapshot.programType === 'EKSKUL' ? 'Ekskul' : 'Weekly',
      reflection: project.snapshot.learningReflection,
    })),
    latestStory,
    featuredProject: projects[0] ?? null,
    learningJourney,
    traits: [
      { label: 'Program & level', detail: `${programLabel} · ${levelLabel}` },
      { label: 'Karya yang dibangun', detail: projectLabel },
      { label: `Skill utama: ${focusSkill}`, detail: journey[0]?.detail || 'Skill akan muncul setelah ada project yang disetujui Coach.' },
      { label: 'Fokus berikutnya', detail: latestStory.nextSteps },
    ],
  };
}

import type { PublishedPortfolioSnapshot } from '@/lib/coderPortfolio';

export type ExperienceProject = {
  id: string;
  snapshot: PublishedPortfolioSnapshot;
  publishedAt: string | null;
};

export type PortfolioExperienceInput = {
  fullName: string;
  schoolName: string | null;
  schoolVisible: boolean;
  levelName: string | null;
  programTypes: Array<'WEEKLY' | 'EKSKUL'>;
  projects: ExperienceProject[];
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
  traits: Array<{ label: string; detail: string }>;
};

function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}` : parts[0]?.slice(0, 2) ?? 'CO').toUpperCase();
}

export function buildPortfolioExperienceModel(input: PortfolioExperienceInput): PortfolioExperienceModel {
  const projects = input.projects ?? [];
  const firstName = input.fullName.trim().split(/\s+/).filter(Boolean)[0] || 'Coder';
  const year = new Date().getFullYear();
  const skillCounts = new Map<string, number>();

  for (const project of projects) {
    for (const skill of project.snapshot.skills ?? []) {
      skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    }
  }

  const journey = [...skillCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .sort(([, left], [, right]) => right - left)
    .slice(0, 4)
    .map(([label, count]) => ({
      label,
      count,
      percent: projects.length > 0 ? Math.round((count / projects.length) * 100) : 0,
      detail: `Muncul di ${count} ${count === 1 ? 'project' : 'project'}.`,
    }));

  const latest = projects[0]?.snapshot;
  const latestStory = {
    roleContribution: latest?.roleContribution || 'Cerita kontribusi coder akan muncul setelah project disetujui Coach.',
    learningReflection: latest?.learningReflection || 'Refleksi belajar akan menjadi bagian dari perjalanan portfolio.',
    nextSteps: latest?.nextSteps || 'Project berikutnya akan menambahkan bab baru di sini.',
  };

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
    latestStory,
    traits: [
      { label: 'Ownership', detail: latestStory.roleContribution },
      { label: 'Refleksi', detail: latestStory.learningReflection },
      { label: 'Eksperimen', detail: `Mengeksplorasi ${Math.max(skillCounts.size, 0)} skill dari karya yang sudah disetujui.` },
      { label: 'Next chapter', detail: latestStory.nextSteps },
    ],
  };
}

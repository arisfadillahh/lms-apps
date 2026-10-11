import { z } from 'zod';

export function buildCoderPortfolioClasses(enrollments: any[] = [], classBlocks: any[] = []) {
  const seen = new Set<string>();

  return enrollments.flatMap((item: any) => {
    const selectedClass = Array.isArray(item.classes) ? item.classes[0] : item.classes;
    if (!selectedClass || seen.has(selectedClass.id) || !['WEEKLY', 'EKSKUL'].includes(selectedClass.type)) return [];
    seen.add(selectedClass.id);

    const blocks = classBlocks
      .flatMap((row: any) => {
        if (row.class_id !== selectedClass.id) return [];
        const block = Array.isArray(row.blocks) ? row.blocks[0] : row.blocks;
        return block ? [{ id: block.id, name: block.name, orderIndex: Number(block.order_index) || 0 }] : [];
      })
      .sort((left: any, right: any) =>
        left.orderIndex - right.orderIndex || left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
      )
      .map(({ id, name }: any) => ({ id, name }));

    return [{
      id: selectedClass.id,
      name: selectedClass.name,
      type: selectedClass.type as 'WEEKLY' | 'EKSKUL',
      levelName: Array.isArray(selectedClass.levels) ? selectedClass.levels[0]?.name : selectedClass.levels?.name,
      blocks,
    }];
  });
}

export const PORTFOLIO_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const PORTFOLIO_MAX_IMAGE_BYTES = 1024 * 1024;
export const PORTFOLIO_MAX_SCREENSHOTS = 5;

export function assertPortfolioImage(file: { type: string; size: number; bytes: Uint8Array }) {
  if (!PORTFOLIO_IMAGE_TYPES.includes(file.type as (typeof PORTFOLIO_IMAGE_TYPES)[number])) {
    throw new Error('Screenshot harus PNG, JPEG, atau WebP.');
  }
  if (file.size > PORTFOLIO_MAX_IMAGE_BYTES) {
    throw new Error('Setiap screenshot harus lebih kecil dari 1 MB.');
  }
  const bytes = file.bytes;
  const isPng = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const isJpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const isWebp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const signatureMatches = file.type === 'image/png' ? isPng : file.type === 'image/jpeg' ? isJpeg : isWebp;
  if (!signatureMatches) {
    throw new Error('Isi file tidak sesuai dengan format screenshot.');
  }
}

const urlSchema = z.string().trim().url('Tautan harus berupa URL lengkap.').refine(
  (value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  },
  'Tautan hanya boleh menggunakan http atau https.',
);

const optionalUrlSchema = z.union([z.literal(''), urlSchema]).optional().transform((value) => value || null);

export const portfolioInputSchema = z.object({
  classId: z.string().uuid(),
  blockId: z.string().uuid().nullable().optional(),
  evaluationSessionId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3).max(120),
  projectType: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(10).max(240),
  description: z.string().trim().min(20).max(3000),
  roleContribution: z.string().trim().min(10).max(1500),
  tools: z.array(z.string().trim().min(1).max(60)).max(20),
  howToPlay: z.string().trim().min(10).max(1500),
  playableUrl: z.union([z.literal(''), urlSchema]),
  repositoryUrl: optionalUrlSchema,
  videoUrl: optionalUrlSchema,
  learningReflection: z.string().trim().min(10).max(2000),
  nextSteps: z.string().trim().min(10).max(1500),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
});

export const portfolioDraftInputSchema = portfolioInputSchema.extend({
  projectType: z.string().trim().max(80),
  summary: z.string().trim().max(240),
  description: z.string().trim().max(3000),
  roleContribution: z.string().trim().max(1500),
  tools: z.array(z.string().trim().min(1).max(60)).max(20),
  howToPlay: z.string().trim().max(1500),
  playableUrl: z.union([z.literal(''), urlSchema]),
  learningReflection: z.string().trim().max(2000),
  nextSteps: z.string().trim().max(1500),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
});

export type PortfolioInput = z.infer<typeof portfolioInputSchema>;

export type PortfolioScreenshot = {
  id: string;
  storage_path: string;
  public_url: string;
  sort_order: number;
  alt_text?: string | null;
};

export type PortfolioRecord = {
  id: string;
  coder_id: string;
  class_id: string | null;
  block_id: string | null;
  evaluation_session_id: string | null;
  program_type: 'WEEKLY' | 'EKSKUL';
  title: string;
  project_type: string;
  summary: string;
  description: string;
  role_contribution: string;
  tools: string[];
  how_to_play: string;
  playable_url: string;
  repository_url: string | null;
  video_url: string | null;
  learning_reflection: string;
  next_steps: string;
  skills: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'REVISION' | 'APPROVED';
  review_note: string | null;
  published_snapshot: PublishedPortfolioSnapshot | null;
};

export type PublishedPortfolioSnapshot = {
  title: string;
  projectType: string;
  summary: string;
  description: string;
  roleContribution: string;
  tools: string[];
  howToPlay: string;
  playableUrl: string;
  repositoryUrl: string | null;
  videoUrl: string | null;
  learningReflection: string;
  nextSteps: string;
  skills: string[];
  programType: 'WEEKLY' | 'EKSKUL';
  screenshots: Array<{ publicUrl: string; sortOrder: number; altText: string | null }>;
};

export function toPortfolioColumns(input: PortfolioInput) {
  return {
    class_id: input.classId,
    block_id: input.blockId ?? null,
    evaluation_session_id: input.evaluationSessionId ?? null,
    title: input.title,
    project_type: input.projectType,
    summary: input.summary,
    description: input.description,
    role_contribution: input.roleContribution,
    tools: input.tools,
    how_to_play: input.howToPlay,
    playable_url: input.playableUrl,
    repository_url: input.repositoryUrl,
    video_url: input.videoUrl,
    learning_reflection: input.learningReflection,
    next_steps: input.nextSteps,
    skills: input.skills,
  };
}

export function nextStatusAfterCoderEdit(status: PortfolioRecord['status']): PortfolioRecord['status'] {
  return status === 'APPROVED' || status === 'SUBMITTED' ? 'REVISION' : status;
}

export function buildPublishedSnapshot(
  portfolio: PortfolioRecord,
  screenshots: PortfolioScreenshot[],
): PublishedPortfolioSnapshot {
  return {
    title: portfolio.title,
    projectType: portfolio.project_type,
    summary: portfolio.summary,
    description: portfolio.description,
    roleContribution: portfolio.role_contribution,
    tools: portfolio.tools,
    howToPlay: portfolio.how_to_play,
    playableUrl: portfolio.playable_url,
    repositoryUrl: portfolio.repository_url,
    videoUrl: portfolio.video_url,
    learningReflection: portfolio.learning_reflection,
    nextSteps: portfolio.next_steps,
    skills: portfolio.skills,
    programType: portfolio.program_type,
    screenshots: [...screenshots]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({
        publicUrl: image.public_url,
        sortOrder: image.sort_order,
        altText: image.alt_text ?? null,
      })),
  };
}

export function assertPortfolioCanSubmit(portfolio: PortfolioRecord, screenshotCount: number) {
  if (screenshotCount < 1) {
    throw new Error('Tambahkan minimal satu screenshot sebelum mengirim portofolio.');
  }
  if (!['DRAFT', 'REVISION', 'APPROVED'].includes(portfolio.status)) {
    throw new Error('Portofolio ini sudah menunggu review Coach.');
  }
  const parsed = portfolioInputSchema.safeParse({
    classId: portfolio.class_id,
    blockId: portfolio.block_id,
    evaluationSessionId: portfolio.evaluation_session_id,
    title: portfolio.title,
    projectType: portfolio.project_type,
    summary: portfolio.summary,
    description: portfolio.description,
    roleContribution: portfolio.role_contribution,
    tools: portfolio.tools,
    howToPlay: portfolio.how_to_play,
    playableUrl: portfolio.playable_url,
    repositoryUrl: portfolio.repository_url ?? '',
    videoUrl: portfolio.video_url ?? '',
    learningReflection: portfolio.learning_reflection,
    nextSteps: portfolio.next_steps,
    skills: portfolio.skills,
  });
  if (!parsed.success) {
    throw new Error('Lengkapi semua bagian wajib sebelum mengirim portofolio ke Coach.');
  }
}

export type DeletePortfolioDependencies = {
  removeScreenshots: (paths: string[]) => Promise<void>;
  deleteRow: (portfolioId: string) => Promise<void>;
};

export async function deletePortfolioPermanently(
  portfolio: Pick<PortfolioRecord, 'id' | 'title'>,
  confirmationTitle: string,
  screenshotPaths: string[],
  dependencies: DeletePortfolioDependencies,
) {
  if (confirmationTitle !== portfolio.title) {
    throw new Error('Judul project yang diketik belum sama persis.');
  }

  if (screenshotPaths.length > 0) {
    await dependencies.removeScreenshots(screenshotPaths);
  }
  await dependencies.deleteRow(portfolio.id);
}

export function makeStablePortfolioSlug(coderId: string) {
  return `coder-${coderId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

export function getPortfolioApiErrorStatus(error: unknown, fallback = 500) {
  const message = error instanceof Error ? error.message : '';
  return message === 'Unauthorized' || message === 'Inactive account' ? 401 : fallback;
}

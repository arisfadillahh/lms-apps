import { describe, expect, it, vi } from 'vitest';

import {
  assertPortfolioCanSubmit,
  assertPortfolioImage,
  buildPublishedSnapshot,
  deletePortfolioPermanently,
  getPortfolioApiErrorStatus,
  nextStatusAfterCoderEdit,
  portfolioDraftInputSchema,
  portfolioInputSchema,
  type PortfolioRecord,
} from '@/lib/coderPortfolio';

function portfolio(overrides: Partial<PortfolioRecord> = {}): PortfolioRecord {
  return {
    id: '223e4567-e89b-12d3-a456-426614174000',
    coder_id: '323e4567-e89b-12d3-a456-426614174000',
    class_id: '123e4567-e89b-12d3-a456-426614174000',
    block_id: '423e4567-e89b-12d3-a456-426614174000',
    evaluation_session_id: null,
    program_type: 'WEEKLY',
    title: 'Space Runner',
    project_type: 'Game',
    summary: 'Game petualangan luar angkasa yang seru.',
    description: 'Pemain mengumpulkan energi sambil menghindari asteroid.',
    role_contribution: 'Saya membuat gameplay, level, dan seluruh ilustrasinya.',
    tools: ['Scratch'],
    how_to_play: 'Gunakan tombol panah untuk bergerak dan spasi untuk melompat.',
    playable_url: 'https://example.com/play',
    repository_url: null,
    video_url: null,
    learning_reflection: 'Saya belajar mengatur collision dan membuat level yang seimbang.',
    next_steps: 'Saya ingin menambahkan boss dan pilihan tingkat kesulitan.',
    skills: ['Game design', 'Debugging'],
    status: 'DRAFT',
    review_note: null,
    published_snapshot: null,
    ...overrides,
  };
}

describe('coder portfolio lifecycle', () => {
  it('keeps a draft before review and marks submitted work as revision when edited', () => {
    expect(nextStatusAfterCoderEdit('DRAFT')).toBe('DRAFT');
    expect(nextStatusAfterCoderEdit('SUBMITTED')).toBe('REVISION');
    expect(nextStatusAfterCoderEdit('REVISION')).toBe('REVISION');
  });

  it('keeps the approved public snapshot unchanged while an approved project is edited', () => {
    const oldSnapshot = buildPublishedSnapshot(portfolio({ title: 'Versi Publik' }), []);
    const approved = portfolio({ status: 'APPROVED', title: 'Versi Edit', published_snapshot: oldSnapshot });

    expect(nextStatusAfterCoderEdit(approved.status)).toBe('REVISION');
    expect(approved.published_snapshot?.title).toBe('Versi Publik');

    const newlyApprovedSnapshot = buildPublishedSnapshot(approved, []);
    expect(newlyApprovedSnapshot.title).toBe('Versi Edit');
  });

  it('requires at least one screenshot at the exact submit boundary', () => {
    expect(() => assertPortfolioCanSubmit(portfolio(), 0)).toThrow(/minimal satu screenshot/i);
    expect(() => assertPortfolioCanSubmit(portfolio(), 1)).not.toThrow();
    expect(() => assertPortfolioCanSubmit(portfolio({ status: 'SUBMITTED' }), 1)).toThrow(/menunggu review/i);
  });

  it('allows a complete project to be submitted without a playable link', () => {
    const withoutPlayableLink = portfolio({ status: 'APPROVED', playable_url: '' });

    expect(() => assertPortfolioCanSubmit(withoutPlayableLink, 1)).not.toThrow();
    expect(buildPublishedSnapshot(withoutPlayableLink, []).playableUrl).toBe('');
  });

  it('rejects an incomplete saved draft at submit time without changing its data', () => {
    const draft = portfolio({ project_type: '', summary: '', description: '', playable_url: '' });
    expect(() => assertPortfolioCanSubmit(draft, 1)).toThrow(/lengkapi semua bagian wajib/i);
    expect(draft.status).toBe('DRAFT');
    expect(draft.title).toBe('Space Runner');
  });

  it('publishes screenshots in display order with the program snapshot', () => {
    const snapshot = buildPublishedSnapshot(portfolio({ program_type: 'EKSKUL' }), [
      { id: '2', storage_path: 'two', public_url: 'https://example.com/2.webp', sort_order: 1 },
      { id: '1', storage_path: 'one', public_url: 'https://example.com/1.webp', sort_order: 0 },
    ]);
    expect(snapshot.programType).toBe('EKSKUL');
    expect(snapshot.screenshots.map((image) => image.publicUrl)).toEqual([
      'https://example.com/1.webp',
      'https://example.com/2.webp',
    ]);
  });
});

describe('permanent portfolio deletion safety', () => {
  it('does nothing when the typed project title is not an exact match', async () => {
    const removeScreenshots = vi.fn();
    const deleteRow = vi.fn();
    await expect(deletePortfolioPermanently(
      portfolio(),
      'space runner',
      ['coder-portfolios/cover.webp'],
      { removeScreenshots, deleteRow },
    )).rejects.toThrow(/sama persis/i);
    expect(removeScreenshots).not.toHaveBeenCalled();
    expect(deleteRow).not.toHaveBeenCalled();
  });

  it('removes stored screenshots before deleting the database row', async () => {
    const operations: string[] = [];
    await deletePortfolioPermanently(portfolio(), 'Space Runner', ['cover', 'detail'], {
      removeScreenshots: vi.fn(async (paths) => { operations.push(`storage:${paths.join(',')}`); }),
      deleteRow: vi.fn(async (id) => { operations.push(`database:${id}`); }),
    });
    expect(operations).toEqual(['storage:cover,detail', 'database:223e4567-e89b-12d3-a456-426614174000']);
  });

  it('preserves the database row when storage cleanup fails', async () => {
    const deleteRow = vi.fn();
    await expect(deletePortfolioPermanently(portfolio(), 'Space Runner', ['cover'], {
      removeScreenshots: vi.fn(async () => { throw new Error('storage unavailable'); }),
      deleteRow,
    })).rejects.toThrow('storage unavailable');
    expect(deleteRow).not.toHaveBeenCalled();
  });
});

describe('portfolio input safety', () => {
  const validInput = {
    classId: '123e4567-e89b-12d3-a456-426614174000',
    blockId: null,
    evaluationSessionId: null,
    title: 'Space Runner',
    projectType: 'Game',
    summary: 'Game luar angkasa yang bisa langsung dimainkan.',
    description: 'Pemain mengumpulkan energi sambil menghindari asteroid.',
    roleContribution: 'Saya membuat gameplay dan seluruh ilustrasinya.',
    tools: ['Scratch'],
    howToPlay: 'Gunakan tombol panah untuk menggerakkan pesawat.',
    playableUrl: 'https://example.com/play',
    repositoryUrl: '',
    videoUrl: '',
    learningReflection: 'Saya belajar membuat collision yang lebih akurat.',
    nextSteps: 'Saya ingin menambahkan pilihan tingkat kesulitan.',
    skills: ['Debugging'],
  };

  it('accepts an http(s) playable URL and normalizes blank optional URLs', () => {
    const result = portfolioInputSchema.parse(validInput);
    expect(result.playableUrl).toBe('https://example.com/play');
    expect(result.repositoryUrl).toBeNull();
    expect(result.videoUrl).toBeNull();
  });

  it('accepts an empty playable URL while keeping unsafe protocols invalid', () => {
    expect(portfolioInputSchema.parse({ ...validInput, playableUrl: '' }).playableUrl).toBe('');
    expect(() => portfolioInputSchema.parse({ ...validInput, playableUrl: 'javascript:alert(1)' })).toThrow(/http/i);
  });

  it('allows a title-only draft that can be continued later', () => {
    const result = portfolioDraftInputSchema.parse({
      ...validInput,
      projectType: '', summary: '', description: '', roleContribution: '', tools: [],
      howToPlay: '', playableUrl: '', learningReflection: '', nextSteps: '', skills: [],
    });
    expect(result.title).toBe('Space Runner');
    expect(result.playableUrl).toBe('');
  });

  it('checks image signatures instead of trusting a spoofed MIME type', () => {
    expect(() => assertPortfolioImage({
      type: 'image/png',
      size: 8,
      bytes: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    })).not.toThrow();
    expect(() => assertPortfolioImage({
      type: 'image/png',
      size: 12,
      bytes: new TextEncoder().encode('not-an-image'),
    })).toThrow(/format screenshot/i);
  });

  it('maps signed-out API access to 401 without leaking internal failures', () => {
    expect(getPortfolioApiErrorStatus(new Error('Unauthorized'))).toBe(401);
    expect(getPortfolioApiErrorStatus(new Error('Inactive account'))).toBe(401);
    expect(getPortfolioApiErrorStatus(new Error('database unavailable'))).toBe(500);
  });
});

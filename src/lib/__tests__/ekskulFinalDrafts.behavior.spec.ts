import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getClass: vi.fn(), enrollments: vi.fn(), sessions: vi.fn(), schedule: vi.fn(),
  attendance: vi.fn(), journeyAttendance: vi.fn(), criteria: vi.fn(),
  findReport: vi.fn(), insertDraft: vi.fn(), descriptions: vi.fn(), saveDescriptions: vi.fn(),
  from: vi.fn(), openRouter: vi.fn(),
}));

vi.mock('@/lib/dao', () => ({
  classesDao: { getClassById: mocks.getClass, listEnrollmentsByClass: mocks.enrollments },
  sessionsDao: { listSessionsByClass: mocks.sessions },
  attendanceDao: { listAttendanceBySession: mocks.attendance, listAttendanceForSessions: mocks.journeyAttendance },
  reportsDao: {
    getEvaluationCriteria: mocks.criteria,
    getBlockReport: mocks.findReport,
    insertDraftReportIfMissing: mocks.insertDraft,
    getBlockReportDescriptions: mocks.descriptions,
    upsertBlockReportDescriptions: mocks.saveDescriptions,
  },
}));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: () => ({ from: mocks.from }) }));
vi.mock('@/lib/services/lessonScheduler', () => ({
  computeLessonSchedule: mocks.schedule,
  formatLessonTitle: (slot: { lessonTemplate: { title: string } }) => slot.lessonTemplate.title,
}));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: mocks.openRouter } }; } }));

import { reconcileEkskulFinalDrafts } from '@/lib/services/aiReports';

const sessions = [
  { id: 'earlier', status: 'COMPLETED', date_time: '2026-11-12T07:45:00Z' },
  { id: 'final', status: 'COMPLETED', date_time: '2026-11-19T07:45:00Z' },
];
const makeSlot = (title: string, globalIndex: number, isEkskulFinalSlot = false) => ({
  lessonTemplate: { title }, globalIndex, partNumber: 1, totalParts: 1, isEkskulFinalSlot,
});
const attendance = sessions.map(({ id }) => ({ session_id: id, coder_id: 'coder', status: 'PRESENT' }));
const scores = sessions.flatMap(({ id }) => ['logic', 'creative'].map((criteria_id) => ({
  session_id: id, coder_id: 'coder', criteria_id, score: id === 'final' ? 9 : 7,
})));

let savedScores: typeof scores;
let existingReports: { id: string; coder_id: string; status: string; is_ai_generated: boolean }[];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('OPENROUTER_API_KEY', 'mock');
  savedScores = [...scores];
  existingReports = [];
  mocks.getClass.mockResolvedValue({ id: 'class', name: 'Ekskul', type: 'EKSKUL', level_id: 'level', ekskul_lesson_plan_id: 'plan' });
  mocks.sessions.mockResolvedValue(sessions);
  mocks.schedule.mockResolvedValue(new Map([['earlier', makeSlot('Materi', 0)], ['final', makeSlot('Presentasi', 1, true)]]));
  mocks.enrollments.mockResolvedValue([{ coder_id: 'coder', status: 'ACTIVE', enrolled_at: '2026-10-01T00:00:00Z', ended_at: null }]);
  mocks.attendance.mockResolvedValue([attendance[1]]);
  mocks.journeyAttendance.mockResolvedValue(attendance);
  mocks.criteria.mockResolvedValue([{ id: 'logic', name: 'Logika' }, { id: 'creative', name: 'Kreativitas' }]);
  mocks.findReport.mockImplementation(async () => existingReports[0] ?? null);
  mocks.insertDraft.mockImplementation(async () => {
    if (existingReports.length) return null;
    const report = { id: 'report', coder_id: 'coder', status: 'DRAFT', is_ai_generated: true };
    existingReports.push(report);
    return report;
  });
  mocks.descriptions.mockResolvedValue([{ criteria_id: 'logic' }, { criteria_id: 'creative' }]);
  mocks.openRouter.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ descriptions: [
    { criteriaId: 'logic', description: 'Ulasan logika' }, { criteriaId: 'creative', description: 'Ulasan kreativitas' },
  ] }) } }] });
  mocks.from.mockImplementation((table: string) => {
    const data = () => {
      if (table === 'lesson_evaluations') return savedScores;
      if (table === 'blocks') return { id: 'block', name: 'Ekskul - Presentasi' };
      if (table === 'block_reports') return existingReports;
      if (table === 'users') return [{ id: 'coder', full_name: 'Coder Demo' }];
      throw new Error(`Unexpected table ${table}`);
    };
    const query = {
      select: () => query, in: () => query, eq: () => query, order: () => query, limit: () => query,
      range: async () => ({ data: data(), error: null }),
      maybeSingle: async () => ({ data: data(), error: null }),
      then: (resolve: (value: unknown) => void) => resolve({ data: data(), error: null }),
    };
    return query;
  });
});

describe('Ekskul final draft reconciliation', () => {
  it('waits for the mapped curriculum finale to be completed', async () => {
    mocks.sessions.mockResolvedValue([sessions[0], { ...sessions[1], status: 'SCHEDULED' }]);
    expect(await reconcileEkskulFinalDrafts('class')).toMatchObject({ count: 0 });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('waits if an earlier lesson has scores but is missing one criterion, then creates the final draft', async () => {
    savedScores = scores.filter((score) => score.session_id !== 'earlier' || score.criteria_id !== 'creative');
    expect(await reconcileEkskulFinalDrafts('class')).toMatchObject({ count: 0 });
    expect(mocks.insertDraft).not.toHaveBeenCalled();

    savedScores = [...scores];
    expect(await reconcileEkskulFinalDrafts('class')).toMatchObject({ count: 1, reportIds: ['report'] });
    expect(mocks.insertDraft).toHaveBeenCalledWith(expect.objectContaining({ averageScore: 8, grade: 'B', status: 'DRAFT' }));
    expect(mocks.saveDescriptions.mock.calls[0][0]).toHaveLength(2);
  });

  it('requires attendance for an eligible learner and excludes a learner who joined after the semester', async () => {
    mocks.journeyAttendance.mockResolvedValue([attendance[1]]);
    expect(await reconcileEkskulFinalDrafts('class')).toMatchObject({ count: 0 });

    mocks.journeyAttendance.mockResolvedValue(attendance);
    mocks.enrollments.mockResolvedValue([
      { coder_id: 'coder', status: 'ACTIVE', enrolled_at: '2026-10-01T00:00:00Z', ended_at: null },
      { coder_id: 'new-coder', status: 'ACTIVE', enrolled_at: '2026-12-01T00:00:00Z', ended_at: null },
    ]);
    expect(await reconcileEkskulFinalDrafts('class')).toMatchObject({ count: 1 });
    expect(mocks.insertDraft).toHaveBeenCalledTimes(1);
  });

  it('uses the description fallback when the provider is unavailable and preserves submitted reports on retry', async () => {
    mocks.openRouter.mockRejectedValue(new Error('Provider unavailable'));
    expect(await reconcileEkskulFinalDrafts('class')).toMatchObject({ count: 1 });
    expect(mocks.saveDescriptions.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ criteriaId: 'logic', score: 8, description: expect.stringContaining('isi deskripsi manual') }),
    ]));
    existingReports[0].status = 'SUBMITTED';
    expect(await reconcileEkskulFinalDrafts('class')).toMatchObject({ count: 0 });
    expect(mocks.insertDraft).toHaveBeenCalledTimes(1);
    expect(mocks.openRouter).toHaveBeenCalledTimes(1);
  });

  it('fills only missing descriptions after a partial write and skips a complete draft', async () => {
    await reconcileEkskulFinalDrafts('class');
    expect(await reconcileEkskulFinalDrafts('class')).toMatchObject({ count: 0, existing: 1 });
    expect(mocks.saveDescriptions).toHaveBeenCalledTimes(1);

    mocks.descriptions.mockResolvedValue([{ criteria_id: 'logic' }]);
    expect(await reconcileEkskulFinalDrafts('class')).toMatchObject({ count: 0, existing: 1 });
    expect(mocks.saveDescriptions.mock.lastCall).toEqual([
      [expect.objectContaining({ criteriaId: 'creative' })], { ignoreDuplicates: true },
    ]);
    expect(mocks.insertDraft).toHaveBeenCalledTimes(1);
  });

  it('stores one draft when two reconciliation requests overlap', async () => {
    const results = await Promise.all([reconcileEkskulFinalDrafts('class'), reconcileEkskulFinalDrafts('class')]);
    expect(results.reduce((total, result) => total + result.count, 0)).toBe(1);
    expect(existingReports).toHaveLength(1);
    expect(mocks.saveDescriptions).toHaveBeenCalledTimes(1);
  });
});

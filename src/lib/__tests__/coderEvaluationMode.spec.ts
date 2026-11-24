import { describe, expect, it } from 'vitest';
import { EVALUATION_LIVE_WINDOW_MS, isCoderEvaluationSelfPaced } from '@/lib/coderEvaluationMode';

describe('Coder evaluation catch-up', () => {
  const opened = '2026-10-10T03:20:47Z';
  const oldSession = { status: 'in_progress', createdAt: opened, meetingAt: '2026-10-10T02:00:00Z', meetingStatus: 'COMPLETED' };
  it('lets an unfinished historical meeting be answered without moving the shared coach presenter', () => {
    expect(isCoderEvaluationSelfPaced(oldSession, new Date('2026-11-24T10:00:00Z'))).toBe(true);
    expect(oldSession.status).toBe('in_progress');
  });
  it('keeps a fresh coach-led session in the live waiting room', () => {
    expect(isCoderEvaluationSelfPaced(oldSession, new Date(Date.parse(opened) + EVALUATION_LIVE_WINDOW_MS - 1))).toBe(false);
    expect(isCoderEvaluationSelfPaced(oldSession, new Date(Date.parse(opened) + EVALUATION_LIVE_WINDOW_MS))).toBe(true);
  });
  it('does not unlock a scheduled or cancelled class, invalid dates, or a newly reopened evaluation', () => {
    const now = new Date('2026-11-24T10:00:00Z');
    for (const meetingStatus of ['SCHEDULED', 'CANCELLED', null]) {
      expect(isCoderEvaluationSelfPaced({ ...oldSession, meetingStatus }, now)).toBe(false);
    }
    expect(isCoderEvaluationSelfPaced({ ...oldSession, createdAt: 'invalid' }, now)).toBe(false);
    expect(isCoderEvaluationSelfPaced({ ...oldSession, meetingAt: null }, now)).toBe(false);
    expect(isCoderEvaluationSelfPaced({ ...oldSession, createdAt: now.toISOString() }, now)).toBe(false);
    expect(isCoderEvaluationSelfPaced({ ...oldSession, meetingAt: now.toISOString() }, now)).toBe(false);
  });
  it('lets a Coder catch up once the coach explicitly completes the evaluation', () => {
    expect(isCoderEvaluationSelfPaced({ ...oldSession, status: 'completed' }, new Date(opened))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import {
  PORTFOLIO_SHORTCUT_WINDOW_MS,
  resolveCoderEvaluationDashboardMode,
} from '@/lib/coderEvaluationDashboard';

const openedAt = '2026-08-20T08:00:00.000Z';

function resolve(overrides: Partial<Parameters<typeof resolveCoderEvaluationDashboardMode>[0]> = {}) {
  return resolveCoderEvaluationDashboardMode({
    status: 'completed',
    createdAt: openedAt,
    now: new Date(openedAt),
    evaluationSubmitted: true,
    portfolioStarted: false,
    ...overrides,
  });
}

describe('coder evaluation dashboard behavior', () => {
  it('keeps the evaluation card as the only action until reflection is submitted', () => {
    expect(resolve({ status: 'in_progress', evaluationSubmitted: false })).toBe('EVALUATION');
    expect(
      resolve({
        status: 'completed',
        evaluationSubmitted: false,
        createdAt: '2026-04-18T02:27:40.317Z',
        now: new Date('2026-08-20T08:00:00.000Z'),
      }),
    ).toBe('EVALUATION');
  });

  it('shows the portfolio shortcut only from submission time through the current evaluation window', () => {
    expect(resolve({ now: new Date('2026-08-20T07:59:59.999Z') })).toBe('HIDDEN');
    expect(resolve({ now: new Date(openedAt) })).toBe('PORTFOLIO');
    expect(resolve({ now: new Date(Date.parse(openedAt) + PORTFOLIO_SHORTCUT_WINDOW_MS) })).toBe('PORTFOLIO');
    expect(resolve({ now: new Date(Date.parse(openedAt) + PORTFOLIO_SHORTCUT_WINDOW_MS + 1) })).toBe('HIDDEN');
  });

  it('does not show another shortcut after the evaluation portfolio has started', () => {
    expect(resolve({ portfolioStarted: true })).toBe('HIDDEN');
  });

  it('hides waiting, invalid, and stale completed sessions', () => {
    expect(resolve({ status: 'waiting' })).toBe('HIDDEN');
    expect(resolve({ createdAt: 'invalid-date' })).toBe('HIDDEN');
    expect(
      resolve({
        createdAt: '2026-04-18T02:27:40.317Z',
        now: new Date('2026-08-20T08:00:00.000Z'),
      }),
    ).toBe('HIDDEN');
  });
});

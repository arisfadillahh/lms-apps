export const PORTFOLIO_SHORTCUT_WINDOW_MS = 4 * 60 * 60 * 1000;

export type CoderEvaluationDashboardMode = 'HIDDEN' | 'EVALUATION' | 'PORTFOLIO';

type ResolveCoderEvaluationDashboardModeInput = {
  status: string;
  createdAt: string;
  now: Date;
  evaluationSubmitted: boolean;
  portfolioStarted: boolean;
};

export function resolveCoderEvaluationDashboardMode({
  status,
  createdAt,
  now,
  evaluationSubmitted,
  portfolioStarted,
}: ResolveCoderEvaluationDashboardModeInput): CoderEvaluationDashboardMode {
  if (status !== 'in_progress' && status !== 'completed') return 'HIDDEN';

  // Completing the reflection always takes priority over the portfolio shortcut,
  // even when a Coach forgot to close an older evaluation session.
  if (!evaluationSubmitted) return 'EVALUATION';

  if (portfolioStarted) return 'HIDDEN';

  const openedAt = Date.parse(createdAt);
  if (!Number.isFinite(openedAt)) return 'HIDDEN';

  const elapsed = now.getTime() - openedAt;
  if (elapsed < 0 || elapsed > PORTFOLIO_SHORTCUT_WINDOW_MS) return 'HIDDEN';

  return 'PORTFOLIO';
}

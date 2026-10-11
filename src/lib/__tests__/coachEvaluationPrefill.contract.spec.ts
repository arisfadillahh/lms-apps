import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Coach evaluation saved-score prefill contract', () => {
  it('loads saved evaluations for the direct evaluation page', () => {
    const page = read('src/app/(coach)/coach/rubrics/[sessionId]/page.tsx');
    const form = read('src/app/(coach)/coach/rubrics/[sessionId]/EvaluationFormClient.tsx');

    expect(page).toContain('reportsDao.getLessonEvaluationsBySession(sessionId)');
    expect(page).toContain('initialScores={initialScores}');
    expect(form).toContain('useState<EvaluationScoreMap>(initialScores)');
  });

  it('loads saved evaluations for the dashboard modal flow', () => {
    const endpoint = read('src/app/api/coach/evaluations/session-data/route.ts');
    const dashboard = read('src/app/(coach)/coach/rubrics/RubricPageClient.tsx');

    expect(endpoint).toContain('reportsDao.getLessonEvaluationsBySession(sessionId)');
    expect(endpoint).toContain('initialScores,');
    expect(dashboard).toContain('useState<EvaluationScoreMap>(data.initialScores)');
  });
});

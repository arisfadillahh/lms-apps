import { describe, expect, it } from 'vitest';

import { buildEvaluationScoreMap } from '@/lib/services/evaluationScores';

describe('buildEvaluationScoreMap', () => {
  const students = [{ id: 'coder-1' }, { id: 'coder-2' }];
  const criteria = [{ id: 'logic' }, { id: 'creativity' }];

  it('prefills saved scores and leaves only missing cells empty', () => {
    const scores = buildEvaluationScoreMap(students, criteria, [
      { coder_id: 'coder-1', criteria_id: 'logic', score: 8 },
      { coder_id: 'coder-1', criteria_id: 'creativity', score: 9 },
      { coder_id: 'coder-2', criteria_id: 'logic', score: 7 },
    ]);

    expect(scores).toEqual({
      'coder-1': { logic: '8', creativity: '9' },
      'coder-2': { logic: '7', creativity: '' },
    });
  });

  it('ignores saved rows outside the current student and criteria roster', () => {
    const scores = buildEvaluationScoreMap(students, criteria, [
      { coder_id: 'former-coder', criteria_id: 'logic', score: 10 },
      { coder_id: 'coder-1', criteria_id: 'retired-criteria', score: 6 },
    ]);

    expect(scores).toEqual({
      'coder-1': { logic: '', creativity: '' },
      'coder-2': { logic: '', creativity: '' },
    });
  });
});

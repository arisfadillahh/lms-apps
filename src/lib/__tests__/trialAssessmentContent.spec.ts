import { describe, expect, it } from 'vitest';

import {
  buildTrialParentReportContent,
  getParentStatus,
  TRIAL_COMPETENCIES,
  type TrialRubric,
} from '@/lib/services/trialAssessmentContent';

describe('trial assessment parent content', () => {
  const rubric: TrialRubric = {
    engagement_curiosity: 4,
    logic_problem_solving: 3,
    creativity_idea_development: 2,
    independence_learning_confidence: 3,
    communication_following_instructions: 4,
  };

  it('maps internal ratings into parent-safe statuses', () => {
    expect(getParentStatus(1)).toBe('Sedang Dibangun');
    expect(getParentStatus(2)).toBe('Mulai Berkembang');
    expect(getParentStatus(3)).toBe('Berkembang Baik');
    expect(getParentStatus(4)).toBe('Menonjol');
  });

  it('provides a specific Indonesian coach description for every competency', () => {
    expect(TRIAL_COMPETENCIES).toHaveLength(5);
    expect(TRIAL_COMPETENCIES.every((competency) => competency.coachDescription.length >= 50)).toBe(true);
    expect(TRIAL_COMPETENCIES.map((competency) => competency.coachDescription)).toContain(
      'Menilai kemampuan anak memahami instruksi, berkomunikasi, dan merespons arahan Coach.',
    );
  });

  it('builds parent report content without exposing raw numeric ratings', () => {
    const content = buildTrialParentReportContent({
      rubric,
      quickObservations: ['Antusias mencoba hal baru', 'Aktif bertanya'],
      personalizedObservation: 'Ananda terlihat antusias dan mulai berani bertanya saat mencoba mini project.',
      recommendationTags: ['Sesuai ketertarikan anak'],
      triedToday: ['Basic Logic', 'Mini Project Trial'],
    });

    expect(content.highlights).toEqual(['Antusias mencoba hal baru', 'Aktif bertanya']);
    expect(content.potential.map((item) => item.status)).toEqual([
      'Menonjol',
      'Berkembang Baik',
      'Mulai Berkembang',
      'Berkembang Baik',
      'Menonjol',
    ]);
    expect(JSON.stringify(content)).not.toMatch(/"rating"|score|dikuasai/i);
    expect(content.strengths).not.toContain('Engagement & Curiosity: Menonjol');
  });

  it('provides detailed default trial activities for the parent story', () => {
    const content = buildTrialParentReportContent({
      rubric,
      quickObservations: [],
      personalizedObservation: 'Catatan Coach.',
      recommendationTags: [],
    });

    expect(content.triedToday).toHaveLength(4);
    expect(content.triedToday.every((activity) => activity.includes(':'))).toBe(true);
    expect(content.triedToday[0]).toBe('Basic Logic: Mengenal cara berpikir logis melalui tantangan sederhana.');
    expect(content.triedToday.join(' ')).not.toContain('Blockly');
  });
});

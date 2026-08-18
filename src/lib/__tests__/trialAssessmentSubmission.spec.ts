import { describe, expect, it } from 'vitest';

import { trialAssessmentSubmissionSchema } from '@/lib/services/trialAssessmentSubmission';

describe('trial assessment submission validation', () => {
  const completePayload = {
    rubric: {
      engagement_curiosity: 4,
      logic_problem_solving: 3,
      creativity_idea_development: 3,
      independence_learning_confidence: 4,
      communication_following_instructions: 3,
    },
    quickObservations: ['Antusias mencoba hal baru', 'Cepat memahami instruksi'],
    personalizedObservation:
      'Saat trial, anak terlihat antusias mencoba fitur baru dan mampu mengikuti arahan dengan baik.',
    internalNotes: 'Perlu konfirmasi jadwal sebelum admin menentukan kelas.',
    recommendedLevelId: '9c4c5a7e-ec28-4ca9-8621-c50147997fe7',
    recommendationTags: ['Sesuai ketertarikan anak'],
    availableDays: ['SATURDAY'],
    availableTimeSlots: ['15:00'],
  };

  it('accepts a complete payload from the Coach form', () => {
    const parsed = trialAssessmentSubmissionSchema.safeParse(completePayload);

    expect(parsed.success).toBe(true);
  });

  it('normalizes string ratings without weakening the allowed 1-4 range', () => {
    const parsed = trialAssessmentSubmissionSchema.safeParse({
      ...completePayload,
      rubric: Object.fromEntries(
        Object.entries(completePayload.rubric).map(([key, value]) => [key, String(value)]),
      ),
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.rubric.engagement_curiosity).toBe(4);

    expect(
      trialAssessmentSubmissionSchema.safeParse({
        ...completePayload,
        rubric: { ...completePayload.rubric, engagement_curiosity: 5 },
      }).success,
    ).toBe(false);
  });
});

import { z } from 'zod';

import { TRIAL_AVAILABILITY_DAY_OPTIONS, TRIAL_AVAILABILITY_TIME_OPTIONS } from './trialAvailability';

const rubricValue = z.coerce.number().int().min(1).max(4);
const availabilityDay = z.enum(TRIAL_AVAILABILITY_DAY_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const availabilityTime = z.enum(TRIAL_AVAILABILITY_TIME_OPTIONS.map((option) => option.value) as [string, ...string[]]);

export const trialAssessmentSubmissionSchema = z.object({
  rubric: z.object({
    engagement_curiosity: rubricValue,
    logic_problem_solving: rubricValue,
    creativity_idea_development: rubricValue,
    independence_learning_confidence: rubricValue,
    communication_following_instructions: rubricValue,
  }),
  quickObservations: z.array(z.string().trim().min(2).max(120)).min(1).max(3),
  personalizedObservation: z.string().trim().min(20).max(800),
  internalNotes: z.string().trim().max(1200).nullable().optional(),
  recommendedLevelId: z.string().uuid(),
  recommendationTags: z.array(z.string().trim().min(2).max(140)).max(6).default([]),
  availableDays: z.array(availabilityDay).min(1).max(7),
  availableTimeSlots: z.array(availabilityTime).min(1).max(6),
});

export type TrialAssessmentSubmission = z.infer<typeof trialAssessmentSubmissionSchema>;

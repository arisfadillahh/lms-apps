import { describe, expect, it } from 'vitest';

import { deriveTrialOutcome, isTrialAssessmentSubmitted } from '@/lib/services/trialLifecycle';

describe('trial outcome lifecycle', () => {
  it('counts only non-draft assessments as submitted coach assessments', () => {
    expect(isTrialAssessmentSubmitted('DRAFT')).toBe(false);
    expect(isTrialAssessmentSubmitted(null)).toBe(false);
    expect(isTrialAssessmentSubmitted('PENDING_ADMIN_REVIEW')).toBe(true);
    expect(isTrialAssessmentSubmitted('PAID')).toBe(true);
  });

  it('keeps a pending or scheduled trial in the not-yet-trial bucket', () => {
    expect(deriveTrialOutcome({ scheduleStatus: 'PENDING' })).toBe('NOT_YET_TRIAL');
    expect(deriveTrialOutcome({ scheduleStatus: 'SCHEDULED', assessmentStatus: 'DRAFT' })).toBe('NOT_YET_TRIAL');
  });

  it('marks a submitted assessment as completed but not registered until payment', () => {
    expect(deriveTrialOutcome({
      scheduleStatus: 'SCHEDULED',
      assessmentStatus: 'PENDING_ADMIN_REVIEW',
      invoiceStatus: 'PENDING',
    })).toBe('COMPLETED_NOT_REGISTERED');
  });

  it('requires a paid invoice for the registered outcome', () => {
    expect(deriveTrialOutcome({
      scheduleStatus: 'SCHEDULED',
      assessmentStatus: 'CONVERTED',
      invoiceStatus: 'PENDING',
    })).toBe('COMPLETED_NOT_REGISTERED');
    expect(deriveTrialOutcome({
      scheduleStatus: 'SCHEDULED',
      assessmentStatus: 'PAID',
      invoiceStatus: 'PAID',
    })).toBe('COMPLETED_REGISTERED');
  });

  it('marks cancelled and failed scheduled trials as not proceeding', () => {
    expect(deriveTrialOutcome({ scheduleStatus: 'CANCELLED' })).toBe('NOT_PROCEEDING');
    expect(deriveTrialOutcome({ scheduleStatus: 'FAILED' })).toBe('NOT_PROCEEDING');
  });
});

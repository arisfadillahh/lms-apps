import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { createAdminNotifications } from '@/lib/dao/notificationsDao';
import { getTrialClassSubmission } from '@/lib/dao/trialClassDao';
import { getOrCreateDraftAssessment, updateAssessment } from '@/lib/dao/trialAssessmentsDao';
import { assertRole } from '@/lib/roles';
import {
  buildTrialParentReportContent,
  isCompleteTrialRubric,
  type TrialRubric,
} from '@/lib/services/trialAssessmentContent';
import { TRIAL_AVAILABILITY_DAY_OPTIONS, TRIAL_AVAILABILITY_TIME_OPTIONS } from '@/lib/services/trialAvailability';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

const rubricValue = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const availabilityDay = z.enum(TRIAL_AVAILABILITY_DAY_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const availabilityTime = z.enum(TRIAL_AVAILABILITY_TIME_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const submitAssessmentSchema = z.object({
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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'COACH');

    const { id } = await context.params;
    const parsed = submitAssessmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data assessment belum lengkap atau tidak valid.' }, { status: 400 });
    }

    const trial = await getTrialClassSubmission(id);
    if (!trial || trial.coach_id !== session.user.id) {
      return NextResponse.json({ error: 'Trial tidak ditemukan untuk coach ini.' }, { status: 404 });
    }
    if (trial.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'Trial ini belum terjadwal atau sudah ditutup.' }, { status: 409 });
    }

    const assessment = await getOrCreateDraftAssessment({ trialId: trial.id, coachId: session.user.id });
    if (assessment.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Assessment sudah dikirim dan sedang diproses admin.' }, { status: 409 });
    }

    const rubric = parsed.data.rubric as TrialRubric;
    if (!isCompleteTrialRubric(rubric)) {
      return NextResponse.json({ error: 'Lengkapi semua rubrik penilaian.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: recommendedLevel, error: levelError } = await supabase
      .from('levels')
      .select('id')
      .eq('id', parsed.data.recommendedLevelId)
      .maybeSingle();

    if (levelError) {
      return NextResponse.json({ error: `Gagal memvalidasi level: ${levelError.message}` }, { status: 500 });
    }
    if (!recommendedLevel) {
      return NextResponse.json({ error: 'Rekomendasi harus memilih level yang valid.' }, { status: 400 });
    }

    const parentReportContent = buildTrialParentReportContent({
      rubric,
      quickObservations: parsed.data.quickObservations,
      personalizedObservation: parsed.data.personalizedObservation,
      recommendationTags: parsed.data.recommendationTags,
    });

    const updated = await updateAssessment(assessment.id, {
      rubric: {
        ...rubric,
        availability: {
          days: parsed.data.availableDays,
          timeSlots: parsed.data.availableTimeSlots,
        },
      },
      quick_observations: parsed.data.quickObservations,
      personalized_observation: parsed.data.personalizedObservation,
      internal_notes: parsed.data.internalNotes ?? null,
      recommended_level_id: recommendedLevel.id,
      recommended_class_id: null,
      recommendation_tags: parsed.data.recommendationTags,
      parent_report_content: parentReportContent as any,
      status: 'PENDING_ADMIN_REVIEW',
      submitted_at: new Date().toISOString(),
    });

    try {
      await createAdminNotifications({
        type: 'TRIAL_ASSESSMENT',
        title: 'Penilaian trial siap direview',
        message: `${session.user.fullName || session.user.username} telah mengirim penilaian trial ${trial.student_name}.`,
        pushUrl: '/admin/trial-assessments',
        pushTag: `trial-assessment-${updated.id}`,
      });
    } catch (notificationError) {
      console.error('[TrialAssessment] Failed to notify admins', notificationError);
    }

    return NextResponse.json({ ok: true, assessment: updated });
  } catch (error) {
    console.error('[TrialAssessment] Coach submit failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menyimpan assessment trial.' },
      { status: 500 },
    );
  }
}

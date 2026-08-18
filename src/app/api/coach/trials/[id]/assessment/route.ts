import { NextResponse } from 'next/server';
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
import { trialAssessmentSubmissionSchema } from '@/lib/services/trialAssessmentSubmission';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'COACH');

    const { id } = await context.params;
    const parsed = trialAssessmentSubmissionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      console.warn(
        '[TrialAssessment] Submission validation failed',
        parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
      );
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

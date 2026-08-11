import { after, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { getAssessmentWithRelations, updateAssessment } from '@/lib/dao/trialAssessmentsDao';
import { getAppBaseUrl } from '@/lib/env';
import { assertRole } from '@/lib/roles';
import {
  buildTrialParentReportContent,
  isCompleteTrialRubric,
  parseTrialRubric,
} from '@/lib/services/trialAssessmentContent';
import { sendTrialParentReportWhatsAppNotification } from '@/lib/services/trialClassNotifications';
import { calculateTrialProgramPrice, DEFAULT_TRIAL_REGISTRATION_FEE } from '@/lib/services/trialPricing';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

const approveSchema = z.object({
  recommendedLevelId: z.string().uuid(),
  classMode: z.enum(['ONLINE', 'OFFLINE']),
  paymentPlanId: z.string().uuid(),
  discountLabel: z.string().trim().max(120).nullable().optional(),
  discountAmount: z.number().int().min(0).max(50_000_000).default(0),
  coachMessage: z.string().max(4000).nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id } = await context.params;
    const parsed = approveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data publish trial report tidak valid.' }, { status: 400 });
    }

    const assessment = await getAssessmentWithRelations(id);
    if (!assessment || !assessment.trial) {
      return NextResponse.json({ error: 'Assessment trial tidak ditemukan.' }, { status: 404 });
    }
    if (!['PENDING_ADMIN_REVIEW', 'APPROVED', 'PUBLISHED'].includes(assessment.status)) {
      return NextResponse.json({ error: 'Assessment belum siap dipublish atau sudah masuk proses pembayaran.' }, { status: 409 });
    }

    const rubric = parseTrialRubric(assessment.rubric);
    if (!isCompleteTrialRubric(rubric)) {
      return NextResponse.json({ error: 'Rubrik coach belum lengkap.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const [levelResult, planResult] = await Promise.all([
      supabase
        .from('levels')
        .select('id, name')
        .eq('id', parsed.data.recommendedLevelId)
        .maybeSingle(),
      supabase
        .from('payment_plans')
        .select('id, duration_months, discount_percent, is_active')
        .eq('id', parsed.data.paymentPlanId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    if (levelResult.error) {
      return NextResponse.json({ error: `Gagal mengambil level: ${levelResult.error.message}` }, { status: 500 });
    }
    if (planResult.error) {
      return NextResponse.json({ error: `Gagal mengambil payment plan: ${planResult.error.message}` }, { status: 500 });
    }
    if (!levelResult.data) {
      return NextResponse.json({ error: 'Level rekomendasi tidak valid.' }, { status: 400 });
    }
    if (!planResult.data) {
      return NextResponse.json({ error: 'Payment plan aktif tidak ditemukan.' }, { status: 400 });
    }

    const { data: pricing, error: pricingError } = await supabase
      .from('pricing')
      .select('id, base_price_monthly')
      .eq('level_id', levelResult.data.id)
      .eq('mode', parsed.data.classMode)
      .eq('is_active', true)
      .maybeSingle();

    if (pricingError) {
      return NextResponse.json({ error: `Gagal mengambil pricing: ${pricingError.message}` }, { status: 500 });
    }
    if (!pricing) {
      return NextResponse.json({ error: `Pricing ${parsed.data.classMode} untuk level rekomendasi belum tersedia.` }, { status: 400 });
    }

    const discountAmount = Math.max(0, parsed.data.discountAmount);
    const planDiscountPercent = Number(planResult.data.discount_percent) || 0;
    const { basePrice, finalPrice } = calculateTrialProgramPrice({
      baseMonthly: Number(pricing.base_price_monthly),
      durationMonths: Number(planResult.data.duration_months) || 1,
      planDiscountPercent,
      discountAmount,
      registrationFee: DEFAULT_TRIAL_REGISTRATION_FEE,
    });

    const generatedParentReportContent = buildTrialParentReportContent({
      rubric,
      quickObservations: assessment.quick_observations ?? [],
      personalizedObservation: assessment.personalized_observation,
      recommendationTags: assessment.recommendation_tags ?? [],
    });
    const existingParentContent = assessment.parent_report_content && typeof assessment.parent_report_content === 'object' && !Array.isArray(assessment.parent_report_content)
      ? assessment.parent_report_content as Record<string, unknown>
      : {};
    const parentReportContent = {
      ...generatedParentReportContent,
      ...existingParentContent,
      coachMessage: parsed.data.coachMessage ?? existingParentContent.coachMessage ?? generatedParentReportContent.coachMessage,
    };

    const publishedAt = new Date().toISOString();
    const updated = await updateAssessment(assessment.id, {
      status: 'PUBLISHED',
      recommended_level_id: levelResult.data.id,
      recommended_class_id: null,
      parent_report_content: parentReportContent as any,
      estimated_start_date: null,
      discount_label: parsed.data.discountLabel?.trim() || null,
      discount_amount: discountAmount,
      base_price: basePrice,
      final_price: finalPrice,
      pricing_id: pricing.id,
      payment_plan_id: planResult.data.id,
      approved_by: session.user.id,
      approved_at: assessment.approved_at ?? publishedAt,
      published_at: assessment.published_at ?? publishedAt,
    });

    const reportUrl = `${getAppBaseUrl()}/trial-report/${updated.public_token}`;
    const { data: trialTemplate, error: reportTemplateError } = await (supabase as any)
      .from('whatsapp_templates')
      .select('template_content, variables')
      .eq('category', 'TRIAL_REPORT_SEND')
      .maybeSingle();
    if (reportTemplateError) {
      console.warn('[TrialAssessment] Failed to load TRIAL_REPORT_SEND template, using default:', reportTemplateError);
    }

    let templateContent = trialTemplate?.template_content ?? null;
    if (!templateContent) {
      const { data: weeklyTemplate } = await (supabase as any)
        .from('whatsapp_templates')
        .select('variables')
        .eq('category', 'REPORT_SEND')
        .maybeSingle();
      const packed = weeklyTemplate?.variables;
      if (packed && !Array.isArray(packed) && typeof packed === 'object') {
        const trial = (packed as { trial?: { content?: string } }).trial;
        templateContent = trial?.content ?? null;
      }
    }

    after(async () => {
      const result = await sendTrialParentReportWhatsAppNotification({
        parentName: assessment.trial!.parent_name,
        parentPhone: assessment.trial!.phone,
        studentName: assessment.trial!.student_name,
        recommendedProgram: levelResult.data?.name ?? 'Weekly Class',
        reportUrl,
        templateContent,
        discountLabel: parsed.data.discountLabel?.trim() || null,
        discountAmount,
        planDiscountPercent,
      });
      if (result.success) {
        await updateAssessment(assessment.id, { report_sent_at: new Date().toISOString() }).catch((error) => {
          console.error('[TrialAssessment] Failed to mark parent report sent', error);
        });
      } else {
        console.error('[TrialAssessment] Failed to send parent trial report WA', result.error);
      }
    });

    return NextResponse.json({ ok: true, assessment: updated, reportUrl });
  } catch (error) {
    console.error('[TrialAssessment] Admin approve failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal publish trial report.' },
      { status: 500 },
    );
  }
}

import { notFound } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { getAssessmentByPublicToken } from '@/lib/dao/trialAssessmentsDao';
import { buildTrialParentReportContent, parseTrialRubric, type TrialParentReportContent } from '@/lib/services/trialAssessmentContent';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';

import TrialStoryReport from './TrialStoryReport';

export const dynamic = 'force-dynamic';

const VISIBLE_STATUSES = new Set([
  'PUBLISHED',
  'REGISTRATION_STARTED',
  'INVOICE_CREATED',
  'PAYMENT_PENDING',
  'PAID',
  'CONVERTED',
]);

const PREVIEW_STATUSES = new Set(['PENDING_ADMIN_REVIEW', 'APPROVED', 'PUBLISHED']);

function asParentContent(value: unknown, fallback: TrialParentReportContent): TrialParentReportContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const source = value as Partial<TrialParentReportContent>;
  return {
    highlights: Array.isArray(source.highlights) ? source.highlights : fallback.highlights,
    potential: Array.isArray(source.potential) ? source.potential : fallback.potential,
    triedToday: Array.isArray(source.triedToday) ? source.triedToday : fallback.triedToday,
    strengths: Array.isArray(source.strengths) ? source.strengths : fallback.strengths,
    growthOpportunities: Array.isArray(source.growthOpportunities) ? source.growthOpportunities : fallback.growthOpportunities,
    coachMessage: typeof source.coachMessage === 'string' ? source.coachMessage : fallback.coachMessage,
    recommendationReasons: Array.isArray(source.recommendationReasons)
      ? source.recommendationReasons
      : fallback.recommendationReasons,
  };
}

export default async function TrialReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  const { preview } = await searchParams;
  const isAdminPreview = preview === '1';
  if (isAdminPreview) {
    const session = await getServerAuthSession();
    if (!session || session.user.role !== 'ADMIN') notFound();
  }
  const assessment = await getAssessmentByPublicToken(token);
  if (!assessment || !assessment.trial || !(VISIBLE_STATUSES.has(assessment.status) || (isAdminPreview && PREVIEW_STATUSES.has(assessment.status)))) {
    notFound();
  }

  const fallbackContent = buildTrialParentReportContent({
    rubric: parseTrialRubric(assessment.rubric) as any,
    quickObservations: assessment.quick_observations ?? [],
    personalizedObservation: assessment.personalized_observation,
    recommendationTags: assessment.recommendation_tags ?? [],
  });
  const content = asParentContent(assessment.parent_report_content, fallbackContent);
  const invoiceUrl = assessment.invoice
    ? buildInvoicePublicUrl(
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://lms.clev.io',
      {
        id: assessment.invoice.id,
        invoice_number: assessment.invoice.invoice_number,
        parent_phone: assessment.invoice.parent_phone || assessment.trial.phone,
        total_amount: assessment.invoice.total_amount,
      },
    )
    : null;

  return (
    <TrialStoryReport
      token={token}
      status={assessment.status}
      studentName={assessment.trial.student_name}
      parentName={assessment.trial.parent_name}
      coachName={assessment.coach?.full_name ?? assessment.trial.coach?.full_name ?? 'Coach Clevio'}
      trialMode={assessment.trial.trial_mode}
      trialDate={assessment.trial.scheduled_at}
      recommendedLevel={assessment.recommended_level?.name ?? 'Weekly Class'}
      basePrice={assessment.base_price}
      finalPrice={assessment.final_price}
      discountLabel={assessment.discount_label}
      discountAmount={assessment.discount_amount}
      invoiceUrl={invoiceUrl}
      content={content}
    />
  );
}

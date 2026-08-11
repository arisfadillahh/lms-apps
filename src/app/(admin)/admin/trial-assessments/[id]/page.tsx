import { notFound } from 'next/navigation';

import PageHead from '@/components/admin/PageHead';
import { getAssessmentWithRelations } from '@/lib/dao/trialAssessmentsDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesRow } from '@/types/supabase';

import TrialAssessmentReviewClient from './TrialAssessmentReviewClient';

export const dynamic = 'force-dynamic';

export type ReviewLevel = Pick<TablesRow<'levels'>, 'id' | 'name' | 'order_index'>;
export type ReviewPricing = Pick<TablesRow<'pricing'>, 'id' | 'level_id' | 'mode' | 'base_price_monthly'>;
export type ReviewPaymentPlan = Pick<TablesRow<'payment_plans'>, 'id' | 'name' | 'duration_months' | 'discount_percent'>;

export default async function AdminTrialAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessment = await getAssessmentWithRelations(id);
  if (!assessment || !assessment.trial) {
    notFound();
  }

  const supabase = getSupabaseAdmin();
  const [levelsResult, pricingResult, paymentPlansResult] = await Promise.all([
    supabase.from('levels').select('id, name, order_index').order('order_index', { ascending: true }),
    supabase
      .from('pricing')
      .select('id, level_id, mode, base_price_monthly')
      .eq('is_active', true)
      .order('base_price_monthly', { ascending: true }),
    supabase
      .from('payment_plans')
      .select('id, name, duration_months, discount_percent')
      .eq('is_active', true)
      .order('duration_months', { ascending: true }),
  ]);

  if (levelsResult.error) throw new Error(`Gagal mengambil level: ${levelsResult.error.message}`);
  if (pricingResult.error) throw new Error(`Gagal mengambil pricing: ${pricingResult.error.message}`);
  if (paymentPlansResult.error) throw new Error(`Gagal mengambil payment plan: ${paymentPlansResult.error.message}`);

  return (
    <div className="admin-page-stack">
      <PageHead
        title="Review Trial Assessment"
        desc="Cek hasil observasi coach, finalisasi rekomendasi weekly, lalu publish report ke orang tua."
      />
      <TrialAssessmentReviewClient
        assessment={assessment}
        levels={(levelsResult.data ?? []) as ReviewLevel[]}
        pricing={(pricingResult.data ?? []) as ReviewPricing[]}
        paymentPlans={(paymentPlansResult.data ?? []) as ReviewPaymentPlan[]}
      />
    </div>
  );
}

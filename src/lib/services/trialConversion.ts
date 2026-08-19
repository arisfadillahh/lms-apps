import { randomBytes } from 'crypto';
import { addMonths, format } from 'date-fns';

import { getOrCreateCCR, getInvoiceById } from '@/lib/dao/invoicesDao';
import {
  findAssessmentByInvoiceId,
  getAssessmentWithRelations,
  updateAssessment,
  type TrialAssessmentWithRelations,
} from '@/lib/dao/trialAssessmentsDao';
import { hashPassword } from '@/lib/passwords';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Invoice } from '@/lib/types/invoice';
import { calculateTrialProgramPrice, DEFAULT_TRIAL_REGISTRATION_FEE } from '@/lib/services/trialPricing';

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildTrialInvoiceNumber(assessmentId: string) {
  const now = new Date();
  return `TRIAL-${format(now, 'yyyyMM')}-${assessmentId.slice(0, 8).toUpperCase()}`;
}

function slugifyName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    .slice(0, 32) || 'trial';
}

async function getOrCreateTrialCoder(assessment: TrialAssessmentWithRelations) {
  if (assessment.coder_id) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('users').select('*').eq('id', assessment.coder_id).maybeSingle();
    if (error) throw new Error(`Gagal mengambil akun coder trial: ${error.message}`);
    if (data) return data;
  }

  const trial = assessment.trial;
  if (!trial) throw new Error('Data trial tidak ditemukan.');

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'CODER')
    .eq('parent_contact_phone', trial.phone)
    .ilike('full_name', trial.student_name)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Gagal mengecek akun coder trial: ${existingError.message}`);
  }
  if (existing) return existing;

  const usernameBase = `trial.${slugifyName(trial.student_name)}.${trial.phone.slice(-4)}`;
  const username = `${usernameBase}.${assessment.id.slice(0, 6)}`;
  const passwordHash = await hashPassword(randomBytes(18).toString('base64url'));

  const { data, error } = await supabase
    .from('users')
    .insert({
      username,
      password_hash: passwordHash,
      full_name: trial.student_name,
      role: 'CODER',
      parent_contact_phone: trial.phone,
      parent_name: trial.parent_name,
      parent_email: trial.email,
      school_name: trial.school_name,
      school_grade: trial.student_grade,
      is_active: true,
      notes: `Dibuat otomatis dari trial class ${trial.id}`,
    } as any)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Gagal membuat akun coder trial: ${error.message}`);
  }

  return data;
}

async function getDefaultPaymentPlan(paymentPlanId?: string | null) {
  const supabase = getSupabaseAdmin();
  if (paymentPlanId) {
    const { data, error } = await supabase
      .from('payment_plans')
      .select('*')
      .eq('id', paymentPlanId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new Error(`Gagal mengambil payment plan: ${error.message}`);
    if (data) return data;
  }

  const { data, error } = await supabase
    .from('payment_plans')
    .select('*')
    .eq('is_active', true)
    .order('duration_months', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`Payment plan aktif belum tersedia${error ? `: ${error.message}` : ''}.`);
  }

  return data;
}

export async function createOrGetTrialConversionInvoice(assessmentId: string) {
  const assessment = await getAssessmentWithRelations(assessmentId);
  if (!assessment) throw new Error('Trial report tidak ditemukan.');
  if (!assessment.trial) throw new Error('Data trial tidak ditemukan.');

  const allowedStatuses = ['APPROVED', 'PUBLISHED', 'REGISTRATION_STARTED', 'INVOICE_CREATED', 'PAYMENT_PENDING', 'PAID', 'CONVERTED'];
  if (!allowedStatuses.includes(assessment.status)) {
    throw new Error('Trial report belum disetujui admin.');
  }
  if (
    !assessment.recommended_level_id ||
    !assessment.pricing_id ||
    assessment.final_price == null ||
    assessment.base_price == null
  ) {
    throw new Error('Rekomendasi level atau harga belum lengkap.');
  }

  if (assessment.invoice_id) {
    const existingInvoice = await getInvoiceById(assessment.invoice_id);
    if (existingInvoice) {
      return { invoice: existingInvoice, reused: true };
    }
  }

  const supabase = getSupabaseAdmin();
  const paymentPlan = await getDefaultPaymentPlan(assessment.payment_plan_id);

  const { data: pricing, error: pricingError } = await supabase
    .from('pricing')
    .select('id, level_id, mode, base_price_monthly, is_active')
    .eq('id', assessment.pricing_id)
    .eq('is_active', true)
    .maybeSingle();

  if (pricingError) throw new Error(`Gagal validasi pricing: ${pricingError.message}`);
  if (!pricing) throw new Error('Pricing yang dipilih sudah tidak aktif.');

  const discountAmount = Math.max(0, Number(assessment.discount_amount) || 0);
  const currentPrice = calculateTrialProgramPrice({
    baseMonthly: Number(pricing.base_price_monthly),
    durationMonths: Number(paymentPlan.duration_months) || 1,
    planDiscountPercent: Number(paymentPlan.discount_percent) || 0,
    discountAmount,
    registrationFee: DEFAULT_TRIAL_REGISTRATION_FEE,
  });
  const legacyPrice = calculateTrialProgramPrice({
    baseMonthly: Number(pricing.base_price_monthly),
    durationMonths: Number(paymentPlan.duration_months) || 1,
    planDiscountPercent: Number(paymentPlan.discount_percent) || 0,
    discountAmount,
    registrationFee: 0,
  });
  const usesLegacyPricing = currentPrice.finalPrice !== Number(assessment.final_price) && legacyPrice.finalPrice === Number(assessment.final_price);
  if (currentPrice.finalPrice !== Number(assessment.final_price) && !usesLegacyPricing) {
    throw new Error('Harga trial report sudah tidak valid. Minta admin review ulang.');
  }
  const { basePrice, finalPrice, registrationFee } = usesLegacyPricing ? legacyPrice : currentPrice;

  const estimatedStart = assessment.estimated_start_date
    ? new Date(`${assessment.estimated_start_date}T00:00:00+07:00`)
    : new Date();
  const periodEnd = addMonths(estimatedStart, paymentPlan.duration_months || 1);
  const dueDate = addDays(new Date(), 3);
  const invoiceNumber = buildTrialInvoiceNumber(assessment.id);

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices' as any)
    .insert({
      invoice_number: invoiceNumber,
      ccr_id: null,
      parent_phone: assessment.trial.phone,
      parent_name: assessment.trial.parent_name,
      period_month: estimatedStart.getMonth() + 1,
      period_year: estimatedStart.getFullYear(),
      period_start_date: format(estimatedStart, 'yyyy-MM-dd'),
      period_end_date: format(periodEnd, 'yyyy-MM-dd'),
      total_amount: finalPrice,
      status: 'PENDING',
      invoice_type: 'REGISTRATION',
      due_date: dueDate.toISOString(),
    })
    .select('*')
    .single();

  if (invoiceError) {
    if (invoiceError.code === '23505') {
      const { data: existingInvoice } = await supabase
        .from('invoices' as any)
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .maybeSingle();
      if (existingInvoice) {
        await updateAssessment(assessment.id, {
          invoice_id: (existingInvoice as any).id,
          payment_plan_id: paymentPlan.id,
          status: 'INVOICE_CREATED',
          registration_started_at: assessment.registration_started_at ?? new Date().toISOString(),
        });
        return { invoice: existingInvoice as unknown as Invoice, reused: true };
      }
    }
    throw new Error(`Gagal membuat invoice trial conversion: ${invoiceError.message}`);
  }

  const { error: itemError } = await supabase
    .from('invoice_items' as any)
    .insert({
      invoice_id: (invoice as any).id,
      // Do not create a coder or Weekly payment record before the invoice is paid.
      coder_id: null,
      coder_name: assessment.trial.student_name,
      class_name: `Level ${assessment.recommended_level?.name ?? 'Weekly Class'}`,
      level_name: assessment.recommended_level?.name ?? 'Weekly Class',
      description: 'Pendaftaran Weekly Class dari Trial Class',
      base_price: basePrice + registrationFee,
      discount_amount: discountAmount,
      final_price: finalPrice,
      payment_period_id: null,
    });

  if (itemError) {
    throw new Error(`Gagal membuat item invoice trial conversion: ${itemError.message}`);
  }

  await updateAssessment(assessment.id, {
    invoice_id: (invoice as any).id,
    payment_plan_id: paymentPlan.id,
    status: 'INVOICE_CREATED',
    registration_started_at: new Date().toISOString(),
  });

  return { invoice: invoice as unknown as Invoice, reused: false };
}

export function buildTrialInvoiceUrl(invoice: Invoice) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://lms.clev.io';
  return buildInvoicePublicUrl(baseUrl, invoice);
}

export async function markTrialConversionPaidFromInvoice(invoiceId: string, paidAt: string) {
  const assessment = await findAssessmentByInvoiceId(invoiceId);
  if (!assessment) return { updated: false, reason: 'not_trial_conversion' };
  if (assessment.status === 'PAID' || (assessment.status === 'CONVERTED' && assessment.converted_at)) {
    return { updated: false, reason: 'already_paid' };
  }
  if (!assessment.pricing_id) {
    throw new Error('Trial conversion belum memiliki pricing lengkap.');
  }

  const supabase = getSupabaseAdmin();
  const [detail, invoice] = await Promise.all([
    getAssessmentWithRelations(assessment.id),
    getInvoiceById(invoiceId),
  ]);
  if (!detail?.trial) throw new Error('Data trial conversion tidak lengkap.');
  if (!invoice) throw new Error('Invoice conversion tidak ditemukan.');
  if (invoice.status !== 'PAID') throw new Error('Trial conversion hanya boleh diproses setelah invoice lunas.');

  const coder = await getOrCreateTrialCoder(detail);
  const paymentPlan = await getDefaultPaymentPlan(detail.payment_plan_id);

  const ccr = await getOrCreateCCR(detail.trial.phone, detail.trial.parent_name);
  if (!ccr) throw new Error('Gagal membuat CCR setelah pembayaran trial.');

  if (!invoice.ccr_id) {
    await supabase.from('invoices' as any).update({ ccr_id: ccr.id }).eq('id', invoice.id);
  }

  let paymentPeriodId = detail.payment_period_id;
  if (!paymentPeriodId) {
    const estimatedStart = detail.estimated_start_date
      ? new Date(`${detail.estimated_start_date}T00:00:00+07:00`)
      : new Date(paidAt);
    const periodEnd = addMonths(estimatedStart, paymentPlan.duration_months || 1);
    periodEnd.setDate(periodEnd.getDate() - 1);
    const { data: paymentPeriod, error: paymentPeriodError } = await supabase
      .from('coder_payment_periods' as any)
      .insert({
        coder_id: coder.id,
        class_id: null,
        payment_plan_id: paymentPlan.id,
        pricing_id: detail.pricing_id,
        start_date: format(estimatedStart, 'yyyy-MM-dd'),
        end_date: format(periodEnd, 'yyyy-MM-dd'),
        total_amount: Number(detail.final_price ?? invoice.total_amount),
        status: 'ACTIVE',
      })
      .select('id')
      .single();

    if (paymentPeriodError || !paymentPeriod) {
      throw new Error(`Gagal membuat periode Weekly setelah pembayaran: ${paymentPeriodError?.message || 'data tidak tersedia'}`);
    }
    paymentPeriodId = (paymentPeriod as unknown as { id: string }).id;
  }

  const { error: invoiceItemError } = await supabase
    .from('invoice_items' as any)
    .update({ coder_id: coder.id, payment_period_id: paymentPeriodId })
    .eq('invoice_id', invoice.id);
  if (invoiceItemError) {
    throw new Error(`Gagal menghubungkan invoice ke akun Weekly: ${invoiceItemError.message}`);
  }

  await updateAssessment(assessment.id, {
    coder_id: coder.id,
    payment_period_id: paymentPeriodId,
    status: 'PAID',
    payment_confirmed_at: paidAt,
    converted_at: null,
  });

  return {
    updated: true,
    assessmentId: assessment.id,
    coderId: coder.id,
    ccrCode: ccr.ccr_code,
    weeklyRegistrationReady: true,
    awaitingManualClassAssignment: true,
  };
}

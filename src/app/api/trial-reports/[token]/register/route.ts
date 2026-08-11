import { NextResponse } from 'next/server';

import { getAssessmentByPublicToken, updateAssessment } from '@/lib/dao/trialAssessmentsDao';
import { buildTrialInvoiceUrl, createOrGetTrialConversionInvoice } from '@/lib/services/trialConversion';

export const runtime = 'nodejs';

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const assessment = await getAssessmentByPublicToken(token);
    if (!assessment || !assessment.trial) {
      return NextResponse.json({ error: 'Trial report tidak ditemukan.' }, { status: 404 });
    }
    if (!['PUBLISHED', 'REGISTRATION_STARTED', 'INVOICE_CREATED', 'PAYMENT_PENDING'].includes(assessment.status)) {
      return NextResponse.json({ error: 'Trial report belum bisa diproses untuk pendaftaran.' }, { status: 409 });
    }

    if (assessment.status === 'PUBLISHED') {
      await updateAssessment(assessment.id, {
        status: 'REGISTRATION_STARTED',
        registration_started_at: new Date().toISOString(),
      });
    }

    const { invoice, reused } = await createOrGetTrialConversionInvoice(assessment.id);
    const invoiceUrl = buildTrialInvoiceUrl(invoice);

    return NextResponse.json({ ok: true, invoiceUrl, invoiceNumber: invoice.invoice_number, reused });
  } catch (error) {
    console.error('[TrialReport] Register conversion failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal membuat invoice pendaftaran weekly.' },
      { status: 500 },
    );
  }
}

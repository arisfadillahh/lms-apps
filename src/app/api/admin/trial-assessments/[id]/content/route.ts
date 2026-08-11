import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { getAssessmentWithRelations, updateAssessment } from '@/lib/dao/trialAssessmentsDao';
import { assertRole } from '@/lib/roles';

const requestSchema = z.object({
  coachMessage: z.string().max(4000),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { id } = await context.params;
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Isi Coach insight tidak valid.' }, { status: 400 });
    }

    const assessment = await getAssessmentWithRelations(id);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment trial tidak ditemukan.' }, { status: 404 });
    }
    if (!['PENDING_ADMIN_REVIEW', 'APPROVED', 'PUBLISHED'].includes(assessment.status)) {
      return NextResponse.json({ error: 'Coach insight tidak bisa diedit setelah proses pembayaran dimulai.' }, { status: 409 });
    }

    const currentContent = assessment.parent_report_content && typeof assessment.parent_report_content === 'object' && !Array.isArray(assessment.parent_report_content)
      ? assessment.parent_report_content as Record<string, unknown>
      : {};
    const updated = await updateAssessment(assessment.id, {
      parent_report_content: {
        ...currentContent,
        coachMessage: parsed.data.coachMessage,
      } as any,
    });

    return NextResponse.json({ ok: true, coachMessage: parsed.data.coachMessage, assessment: updated });
  } catch (error) {
    console.error('[TrialAssessment] Update coach insight failed', error);
    return NextResponse.json({ error: 'Gagal menyimpan Coach insight.' }, { status: 500 });
  }
}

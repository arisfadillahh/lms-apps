import { after, NextResponse } from 'next/server';

import { createTrialClassSubmission } from '@/lib/dao/trialClassDao';
import { sendTrialClassNotifications } from '@/lib/services/trialClassNotifications';
import { normalizeIndonesianPhone, trialClassSchema } from '@/lib/validation/trialClass';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = trialClassSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Periksa kembali data yang diisi.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Silently accept bot submissions caught by the honeypot without writing data.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  try {
    const submission = await createTrialClassSubmission({
      student_name: parsed.data.studentName,
      student_grade: parsed.data.studentGrade,
      school_name: parsed.data.schoolName,
      parent_name: parsed.data.parentName,
      phone: normalizeIndonesianPhone(parsed.data.phone),
      email: parsed.data.email.toLowerCase(),
      trial_mode: parsed.data.trialMode,
      notes: parsed.data.notes || null,
    });

    after(async () => {
      const delivery = await sendTrialClassNotifications({
        id: submission.id,
        studentName: submission.student_name,
        studentGrade: submission.student_grade,
        schoolName: submission.school_name,
        parentName: submission.parent_name,
        phone: submission.phone,
        email: submission.email,
        trialMode: submission.trial_mode,
        notes: submission.notes,
        createdAt: submission.created_at,
      });

      console.log('[FreeTrial] WhatsApp notification result', {
        submissionId: submission.id,
        adminGroup: delivery.adminGroup.success,
        parent: delivery.parent.success,
      });
    });

    return NextResponse.json({ ok: true, id: submission.id }, { status: 201 });
  } catch (error) {
    console.error('[FreeTrial] Failed to save submission', error);
    return NextResponse.json(
      { ok: false, message: 'Data belum berhasil disimpan. Silakan coba lagi.' },
      { status: 500 },
    );
  }
}

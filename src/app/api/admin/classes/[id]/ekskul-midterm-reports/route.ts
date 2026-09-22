import { after, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { generateEkskulMidtermReports } from '@/lib/services/aiReports';

const payloadSchema = z.object({
  cutoffAt: z.string().datetime(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  const { id: classId } = await params;

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Tanggal batas rapor tidak valid.' }, { status: 400 });
  }

  const klass = await classesDao.getClassById(classId);
  if (!klass) return NextResponse.json({ error: 'Kelas tidak ditemukan.' }, { status: 404 });
  if (klass.type !== 'EKSKUL') {
    return NextResponse.json({ error: 'Fitur ini hanya untuk kelas Ekskul.' }, { status: 400 });
  }

  const cutoff = new Date(parsed.data.cutoffAt);
  if (cutoff.getTime() > Date.now()) {
    return NextResponse.json({ error: 'Tanggal batas rapor tidak boleh berada di masa depan.' }, { status: 400 });
  }

  after(async () => {
    try {
      await generateEkskulMidtermReports({
        classId,
        cutoffAt: parsed.data.cutoffAt,
        initiatedBy: session.user.id,
      });
    } catch (error) {
      console.error('[EkskulMidtermReports] Background generation failed', { classId, error });
    }
  });

  return NextResponse.json({ queued: true }, { status: 202 });
}

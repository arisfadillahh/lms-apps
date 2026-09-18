import { NextResponse } from 'next/server';
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

  try {
    const result = await generateEkskulMidtermReports({
      classId,
      cutoffAt: parsed.data.cutoffAt,
      initiatedBy: session.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membuat draf rapor tengah semester.';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { isValidTransferTarget } from '@/lib/services/classTransferPolicy';
import { initializeWeeklyEnrollmentJourney } from '@/lib/services/weeklyEnrollmentSetup';
import { transferCoderSchema } from '@/lib/validation/admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');
    const { id: fromClassId } = await context.params;
    const parsed = transferCoderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Data perpindahan belum lengkap', details: parsed.error.flatten() }, { status: 400 });

    const [coder, fromClass, toClass] = await Promise.all([
      usersDao.getUserById(parsed.data.coderId),
      classesDao.getClassById(fromClassId),
      classesDao.getClassById(parsed.data.targetClassId),
    ]);
    if (!coder || coder.role !== 'CODER') return NextResponse.json({ error: 'Coder tidak ditemukan' }, { status: 404 });
    if (!fromClass || !toClass) return NextResponse.json({ error: 'Kelas asal atau tujuan tidak ditemukan' }, { status: 404 });
    if (!isValidTransferTarget(fromClass, toClass)) {
      return NextResponse.json({ error: 'Kelas tujuan harus aktif, dalam program dan level yang sama' }, { status: 400 });
    }

    const enrollment = await classesDao.transferCoderEnrollment({
      coderId: coder.id, fromClassId, toClassId: toClass.id,
      effectiveAt: parsed.data.effectiveAt, reason: parsed.data.reason, adminId: session.user.id,
    });
    let warning: string | null = null;
    try {
      await initializeWeeklyEnrollmentJourney({ klass: toClass, enrollment, mode: 'TRANSFER' });
    } catch (error) {
      console.error('[EnrollmentTransfer] Journey setup failed after transfer', error);
      warning = 'Perpindahan tersimpan, tetapi akses materi perlu diperiksa.';
    }
    return NextResponse.json({ success: true, enrollment, warning });
  } catch (error) {
    console.error('[EnrollmentTransfer] Failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal memindahkan coder' }, { status: 400 });
  }
}
